import type { MailCategory, Priority, RawMail } from './mail';
import type { SmtpServerConfig } from './settings';

/** POST /api/mail/test 请求体 */
export interface MailTestRequest {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  /** 发件服务器（可选，提供时将一并测试连通性） */
  smtp?: SmtpServerConfig;
}

export interface MailTestResponse {
  ok: boolean;
  error?: string;
  mailbox?: string;
  total?: number;
  /** 发件服务器测试结果（未配置 SMTP 时不返回） */
  smtp?: {
    ok: boolean;
    error?: string;
  };
}

/** POST /api/mail/sync 请求体 */
export interface MailSyncRequest {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  /** 增量同步：拉取 UID 大于该值的新邮件 */
  lastUid?: number;
  /** 翻页：拉取 UID 小于该值的更早邮件 */
  beforeUid?: number;
  /** 增量同步的时间范围（天）：仅拉取最近 N 天的邮件，0 或缺省表示不限制 */
  sinceDays?: number;
  limit?: number;
}

export interface MailSyncResponse {
  mails: RawMail[];
  lastUid: number;
  hasMore: boolean;
  total: number;
  /** 本次搜索条件匹配到的邮件总数（用于同步进度展示） */
  pending: number;
}

/** POST /api/mail/send 请求体 */
export interface MailSendRequest {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  smtp: SmtpServerConfig;
  mail: {
    to: string[];
    cc?: string[];
    subject: string;
    body: string;
    /** HTML 正文（提供时以 multipart/alternative 发送，body 作为纯文本降级） */
    html?: string;
    /** 回复时指向原邮件 Message-ID */
    inReplyTo?: string;
    /** 会话引用链 */
    references?: string[];
  };
}

export interface MailSendResponse {
  ok: boolean;
  error?: string;
  /** 服务端接受的 Message-ID（用于本地入库与后续同步去重） */
  messageId?: string;
}

/** POST /api/mail/attachment 请求体：按邮件 UID + 附件序号拉取附件内容 */
export interface MailAttachmentRequest {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  /** 邮件 UID（仅同步过的收件箱邮件可下载） */
  uid: number;
  /** 附件在列表中的序号（与同步时 attachments 数组顺序一致） */
  index: number;
}

export interface MailAttachmentResponse {
  ok: boolean;
  error?: string;
  filename?: string;
  contentType?: string;
  /** base64 编码的附件内容 */
  contentBase64?: string;
}

/** POST /api/ai/summarize 请求体 */
export interface AISummarizeRequest {
  mode: 'mail' | 'task';
  subject: string;
  from?: string;
  body: string;
  /** 用户自有 AI 配置（可选，缺省时使用服务端环境变量） */
  ai?: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
}

/** AI 摘要结果（服务端解析好的结构） */
export interface AISummaryResult {
  coreContent: string;
  keyPoints: string[];
  actionItems: Array<{
    content: string;
    deadline?: string;
    assignee?: string;
    confidence: number;
  }>;
  priority: Priority;
  category: MailCategory;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface AISummarizeResponse {
  result?: AISummaryResult;
  /** 模型原始返回内容（含推理模型的思考过程），供前端打字机逐字展示 */
  raw?: string;
  error?: string;
}

/** AI 摘要流式事件（SSE data 载荷，服务端→前端）：delta=增量文本 done=完成并附结构化结果 error=失败 */
export type AISummarizeStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; result: AISummaryResult; raw: string }
  | { type: 'error'; error: string };

/** POST /api/ai/test 请求体：仅需 AI 配置（缺省时用服务端环境变量） */
export interface AITestRequest {
  ai?: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
}

export interface AITestResponse {
  ok: boolean;
  error?: string;
  model?: string;
  message?: string;
}

export interface ApiErrorResponse {
  error: string;
}
