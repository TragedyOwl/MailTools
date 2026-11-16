import { ImapFlow } from 'imapflow';
import { simpleParser, type AddressObject, type ParsedMail } from 'mailparser';
import type {
  MailAddress,
  MailAttachmentResponse,
  MailSyncRequest,
  MailSyncResponse,
  MailTestResponse,
  RawMail,
} from '../src/types';

const CONNECT_TIMEOUT_MS = 10000;
const SOCKET_TIMEOUT_MS = 25000;
const BODY_MAX_CHARS = 20000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
/** 附件下载体积上限（服务端内存与响应体限制） */
const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

type UnknownRecord = Record<string, unknown>;

const asRecord = (payload: unknown): UnknownRecord =>
  typeof payload === 'object' && payload !== null ? (payload as UnknownRecord) : {};

const requireString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`缺少必要参数: ${field}`);
  }
  return value;
};

const toNumber = (value: unknown, fallback: number): number => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : fallback;
};

interface ImapCredentials {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

const parseCredentials = (payload: unknown): ImapCredentials => {
  const body = asRecord(payload);
  return {
    host: requireString(body.host, 'host'),
    port: toNumber(body.port, 993),
    secure: body.secure !== false,
    user: requireString(body.user, 'user'),
    password: requireString(body.password, 'password'),
  };
};

const createClient = (credentials: ImapCredentials): ImapFlow =>
  new ImapFlow({
    host: credentials.host,
    port: credentials.port,
    secure: credentials.secure,
    auth: { user: credentials.user, pass: credentials.password },
    logger: false,
    greetingTimeout: CONNECT_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
    disableAutoIdle: true,
  });

const normalizeAddresses = (input: AddressObject | AddressObject[] | undefined): MailAddress[] => {
  if (!input) return [];
  const list = Array.isArray(input) ? input : [input];
  return list.flatMap((obj) =>
    (obj.value ?? [])
      .filter((addr) => Boolean(addr.address))
      .map((addr) => ({ name: addr.name ?? '', email: addr.address ?? '' }))
  );
};

const normalizeReferences = (input: string | string[] | undefined): string[] => {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
};

const parsedToRaw = (parsed: ParsedMail, uid: number, flags: string[]): RawMail => {
  const from = normalizeAddresses(parsed.from)[0] ?? { name: '', email: '' };
  return {
    uid,
    messageId: parsed.messageId ?? `uid-${uid}`,
    subject: parsed.subject ?? '(无主题)',
    from,
    to: normalizeAddresses(parsed.to),
    cc: normalizeAddresses(parsed.cc),
    date: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
    bodyText: (parsed.text ?? '').slice(0, BODY_MAX_CHARS),
    bodyHtml: typeof parsed.html === 'string' ? parsed.html.slice(0, BODY_MAX_CHARS * 2) : undefined,
    attachments: (parsed.attachments ?? []).map((att) => ({
      filename: att.filename ?? '未命名附件',
      contentType: att.contentType ?? 'application/octet-stream',
      size: att.size ?? 0,
    })),
    flags,
    inReplyTo: parsed.inReplyTo || undefined,
    references: normalizeReferences(parsed.references),
    folder: 'INBOX',
  };
};

/** POST /api/mail/test：测试 IMAP 连接 */
export const handleMailTest = async (payload: unknown): Promise<MailTestResponse> => {
  const credentials = parseCredentials(payload);
  const client = createClient(credentials);
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const status = await client.status('INBOX', { messages: true });
      return { ok: true, mailbox: 'INBOX', total: status.messages ?? 0 };
    } finally {
      lock.release();
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    if (client.usable) {
      try {
        await client.logout();
      } catch {
        /* 忽略登出异常 */
      }
    }
  }
};

/**
 * POST /api/mail/sync：
 * - 增量模式：拉取 UID > lastUid 的新邮件（新的在前）
 * - 翻页模式：拉取 UID < beforeUid 的更早邮件
 */
export const handleMailSync = async (payload: unknown): Promise<MailSyncResponse> => {
  const body = asRecord(payload);
  const request: MailSyncRequest = {
    host: requireString(body.host, 'host'),
    port: toNumber(body.port, 993),
    secure: body.secure !== false,
    user: requireString(body.user, 'user'),
    password: requireString(body.password, 'password'),
    lastUid: toNumber(body.lastUid, 0),
    beforeUid: toNumber(body.beforeUid, 0),
    sinceDays: toNumber(body.sinceDays, 0),
    limit: Math.min(toNumber(body.limit, DEFAULT_LIMIT), MAX_LIMIT),
  };

  const client = createClient(request);
  await client.connect();

  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const status = await client.status('INBOX', { messages: true, uidNext: true });
      const total = status.messages ?? 0;
      // 部分服务器（如 coremail 企业邮）STATUS 不返回 UIDNEXT，0 表示未知
      const uidNext = status.uidNext ?? 0;
      const limit = request.limit ?? DEFAULT_LIMIT;

      let range = '';
      if (request.beforeUid && request.beforeUid > 1) {
        range = `1:${request.beforeUid - 1}`;
      } else if (request.beforeUid === 1) {
        return { mails: [], lastUid: request.lastUid ?? 0, hasMore: false, total, pending: 0 };
      } else {
        const from = (request.lastUid ?? 0) + 1;
        // 仅当 uidNext 已知时才可断定无新邮件；未知时交给 SEARCH 结果判断
        if (uidNext > 0 && from >= uidNext) {
          return { mails: [], lastUid: request.lastUid ?? 0, hasMore: false, total, pending: 0 };
        }
        range = `${from}:*`;
      }

      // 增量同步默认限定时间范围（SINCE），避免大邮箱全量扫描导致超时
      const searchQuery: { uid: string; since?: Date } = { uid: range };
      if (!request.beforeUid && (request.sinceDays ?? 0) > 0) {
        searchQuery.since = new Date(Date.now() - (request.sinceDays ?? 0) * 24 * 60 * 60 * 1000);
      }
      const searchResult = await client.search(searchQuery, { uid: true });
      const uids = Array.isArray(searchResult) ? [...searchResult] : [];
      uids.sort((a, b) => b - a);

      const batch = uids.slice(0, limit);
      const hasMore = uids.length > limit;

      if (batch.length === 0) {
        return { mails: [], lastUid: request.lastUid ?? 0, hasMore: false, total, pending: 0 };
      }

      const mails: RawMail[] = [];
      const fetchQuery = { uid: true, flags: true, source: true } as const;
      for await (const message of client.fetch(batch, fetchQuery, { uid: true })) {
        if (!message.source) continue;
        try {
          const parsed = await simpleParser(message.source);
          mails.push(parsedToRaw(parsed, message.uid, [...(message.flags ?? [])]));
        } catch {
          // 单封解析失败不阻断整体同步
        }
      }

      mails.sort((a, b) => b.uid - a.uid);
      const maxUid = Math.max(...batch);
      return {
        mails,
        lastUid: request.beforeUid ? (request.lastUid ?? 0) : Math.max(request.lastUid ?? 0, maxUid),
        hasMore,
        total,
        pending: uids.length,
      };
    } finally {
      lock.release();
    }
  } finally {
    if (client.usable) {
      try {
        await client.logout();
      } catch {
        /* 忽略登出异常 */
      }
    }
  }
};

/**
 * POST /api/mail/attachment：按 UID 拉取指定邮件的指定序号附件（base64 返回）。
 * 附件内容不落库，按需从 IMAP 服务器实时获取；超过体积上限时拒绝。
 */
export const handleFetchAttachment = async (payload: unknown): Promise<MailAttachmentResponse> => {
  const body = asRecord(payload);
  const credentials = parseCredentials(body);
  const uid = toNumber(body.uid, 0);
  const index = Number.isFinite(Number(body.index)) && Number(body.index) >= 0 ? Math.floor(Number(body.index)) : -1;
  if (!uid) return { ok: false, error: '缺少必要参数: uid' };
  if (index < 0) return { ok: false, error: '缺少必要参数: index' };

  const client = createClient(credentials);
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const message = await client.fetchOne(String(uid), { source: true }, { uid: true });
      if (!message || !message.source) return { ok: false, error: '未找到对应邮件（可能已被删除或移动）' };
      const parsed = await simpleParser(message.source);
      const attachments = parsed.attachments ?? [];
      const attachment = attachments[index];
      if (!attachment) return { ok: false, error: '未找到对应附件' };
      if (attachment.size > ATTACHMENT_MAX_BYTES) {
        return { ok: false, error: '附件超过 10MB 上限，请在网页版邮箱中下载' };
      }
      return {
        ok: true,
        filename: attachment.filename ?? '未命名附件',
        contentType: attachment.contentType ?? 'application/octet-stream',
        contentBase64: attachment.content.toString('base64'),
      };
    } finally {
      lock.release();
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    if (client.usable) {
      try {
        await client.logout();
      } catch {
        /* 忽略登出异常 */
      }
    }
  }
};
