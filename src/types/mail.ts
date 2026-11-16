/** 邮件分类 */
export type MailCategory = 'notification' | 'task' | 'meeting' | 'approval' | 'other';

/** 优先级 */
export type Priority = 'high' | 'medium' | 'low';

/** 邮件地址 */
export interface MailAddress {
  name: string;
  email: string;
}

/** 联系人（地址簿）：由收发邮件的发件人/收件人/抄送自动累积，用于写信时快速补全 */
export interface MailContact {
  /** 邮箱地址（小写，主键） */
  email: string;
  name: string;
  /** 往来次数（每次出现在邮件中 +1） */
  count: number;
  /** 最近一次往来时间（ISO） */
  lastUsedAt: string;
}

/** 附件元信息（附件内容不落库，仅保留元数据） */
export interface Attachment {
  filename: string;
  contentType: string;
  size: number;
}

/** AI 提取的待办事项 */
export interface ActionItem {
  content: string;
  deadline?: string;
  assignee?: string;
  confidence: number;
}

/** AI 标准化摘要 */
export interface MailSummary {
  coreContent: string;
  keyPoints: string[];
  actionItems: ActionItem[];
  sentiment: 'positive' | 'neutral' | 'negative';
  /** 摘要来源：ai=大模型生成 local=本地降级规则生成 */
  source: 'ai' | 'local';
  generatedAt: string;
}

/** 服务端返回的原始邮件（代理层解析后的结构） */
export interface RawMail {
  uid: number;
  messageId: string;
  subject: string;
  from: MailAddress;
  to: MailAddress[];
  cc?: MailAddress[];
  date: string;
  bodyText: string;
  bodyHtml?: string;
  attachments: Attachment[];
  flags: string[];
  inReplyTo?: string;
  references?: string[];
  folder: string;
}

/** 邮件实体 */
export interface Mail {
  id: string;
  uid: number;
  messageId: string;
  subject: string;
  from: MailAddress;
  to: MailAddress[];
  cc?: MailAddress[];
  date: string;
  bodyText: string;
  bodyHtml?: string;
  attachments: Attachment[];
  flags: string[];
  inReplyTo?: string;
  references?: string[];
  folder: string;

  summary?: MailSummary;
  category: MailCategory;
  priority: Priority;

  taskId?: string;

  createdAt: string;
  syncedAt: string;
}

export const isUnread = (mail: Mail): boolean => !mail.flags.includes('\\Seen');

export const isFlagged = (mail: Mail): boolean => mail.flags.includes('\\Flagged');

export const isDraft = (mail: Mail): boolean => mail.flags.includes('\\Draft');
