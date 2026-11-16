import type {
  MailAttachmentRequest,
  MailAttachmentResponse,
  MailSendRequest,
  MailSendResponse,
  MailSyncRequest,
  MailSyncResponse,
  MailTestRequest,
  MailTestResponse,
  SmtpServerConfig,
} from '@/types';
import { SYNC_PAGE_SIZE } from '@/utils/constants';

const REQUEST_TIMEOUT_MS = 60000;
/** 附件下载超时：大文件传输预留更长时间 */
const ATTACHMENT_TIMEOUT_MS = 120000;

const post = async <TResponse>(url: string, body: unknown, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<TResponse> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data as TResponse;
};

export interface ImapAccountInput {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  /** 发件服务器（可选） */
  smtp?: SmtpServerConfig;
}

/** 测试 IMAP 连接 */
export const testConnection = (account: ImapAccountInput): Promise<MailTestResponse> => {
  const payload: MailTestRequest = { ...account };
  return post<MailTestResponse>('/api/mail/test', payload);
};

/** 增量同步：拉取 lastUid 之后的新邮件（sinceDays 限定最近 N 天，0 为不限制） */
export const syncNewMails = (
  account: ImapAccountInput,
  lastUid: number,
  sinceDays = 0,
  limit: number = SYNC_PAGE_SIZE
): Promise<MailSyncResponse> => {
  const payload: MailSyncRequest = { ...account, lastUid, sinceDays, limit };
  return post<MailSyncResponse>('/api/mail/sync', payload);
};

/** 翻页：拉取 beforeUid 之前的更早邮件 */
export const fetchOlderMails = (
  account: ImapAccountInput,
  lastUid: number,
  beforeUid: number,
  limit: number = SYNC_PAGE_SIZE
): Promise<MailSyncResponse> => {
  const payload: MailSyncRequest = { ...account, lastUid, beforeUid, limit };
  return post<MailSyncResponse>('/api/mail/sync', payload);
};

/** SMTP 发件输入：必须包含发件服务器配置 */
export interface SendMailInput extends ImapAccountInput {
  smtp: SmtpServerConfig;
}

/** 通过 SMTP 发送邮件（回复/转发/新写共用） */
export const sendMail = (account: SendMailInput, mail: MailSendRequest['mail']): Promise<MailSendResponse> => {
  const payload: MailSendRequest = { ...account, mail };
  return post<MailSendResponse>('/api/mail/send', payload);
};

/** 按需拉取附件内容（base64），仅同步过的收件箱邮件（uid > 0）可下载 */
export const fetchAttachment = (account: ImapAccountInput, uid: number, index: number): Promise<MailAttachmentResponse> => {
  const payload: MailAttachmentRequest = { ...account, uid, index };
  return post<MailAttachmentResponse>('/api/mail/attachment', payload, ATTACHMENT_TIMEOUT_MS);
};
