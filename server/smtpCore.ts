import nodemailer from 'nodemailer';

const CONNECT_TIMEOUT_MS = 10000;
const SOCKET_TIMEOUT_MS = 15000;

type UnknownRecord = Record<string, unknown>;

const asRecord = (payload: unknown): UnknownRecord =>
  typeof payload === 'object' && payload !== null ? (payload as UnknownRecord) : {};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
};

export interface SmtpTestResult {
  ok: boolean;
  error?: string;
}

export interface SmtpSendResult {
  ok: boolean;
  error?: string;
  /** 服务端接受的 Message-ID（用于本地入库与后续同步去重） */
  messageId?: string;
}

/**
 * 测试 SMTP 发件服务器连通性（EHLO + 认证）。
 * payload 需包含 user/password 与 smtp: { host, port, secure }；
 * 未配置 smtp.host 时返回 undefined（调用方跳过）。
 */
export const handleSmtpTest = async (payload: unknown): Promise<SmtpTestResult | undefined> => {
  const body = asRecord(payload);
  const smtp = asRecord(body.smtp);
  const host = typeof smtp.host === 'string' ? smtp.host.trim() : '';
  if (!host) return undefined;

  const port = Number(smtp.port) > 0 ? Math.floor(Number(smtp.port)) : 465;
  const secure = smtp.secure !== false;
  const user = typeof body.user === 'string' ? body.user : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass: password },
    connectionTimeout: CONNECT_TIMEOUT_MS,
    greetingTimeout: CONNECT_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
  });

  try {
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    transporter.close();
  }
};

/**
 * POST /api/mail/send：通过 SMTP 发送邮件。
 * payload 需包含 user/password、smtp: { host, port, secure } 与
 * mail: { to, cc, subject, body, inReplyTo, references }。
 */
export const handleMailSend = async (payload: unknown): Promise<SmtpSendResult> => {
  const body = asRecord(payload);
  const smtp = asRecord(body.smtp);
  const mail = asRecord(body.mail);

  const host = typeof smtp.host === 'string' ? smtp.host.trim() : '';
  if (!host) return { ok: false, error: '未配置发件服务器（SMTP），请在设置页补充' };

  const port = Number(smtp.port) > 0 ? Math.floor(Number(smtp.port)) : 465;
  const secure = smtp.secure !== false;
  const user = typeof body.user === 'string' ? body.user : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const to = asStringArray(mail.to);
  const cc = asStringArray(mail.cc);
  const subject = typeof mail.subject === 'string' ? mail.subject : '';
  const text = typeof mail.body === 'string' ? mail.body : '';
  const html = typeof mail.html === 'string' && mail.html.trim().length > 0 ? mail.html : undefined;

  if (to.length === 0) return { ok: false, error: '收件人不能为空' };

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass: password },
    connectionTimeout: CONNECT_TIMEOUT_MS,
    greetingTimeout: CONNECT_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
  });

  try {
    const info = await transporter.sendMail({
      from: user,
      to,
      cc: cc.length > 0 ? cc : undefined,
      subject: subject || '(无主题)',
      text,
      // 提供 HTML 正文时以 multipart/alternative 发送（text 作为纯文本降级）
      html,
      inReplyTo: typeof mail.inReplyTo === 'string' && mail.inReplyTo ? mail.inReplyTo : undefined,
      references: asStringArray(mail.references).length > 0 ? asStringArray(mail.references) : undefined,
    });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    transporter.close();
  }
};
