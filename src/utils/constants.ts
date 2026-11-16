import type { EventType, MailCategory, Priority } from '@/types';

/** 单次同步拉取邮件数上限 */
export const SYNC_PAGE_SIZE = 50;

/** AI 摘要输入正文最大字符数（超出截断） */
export const AI_MAX_BODY_CHARS = 4000;

/** 邮件正文落库最大字符数 */
export const MAIL_BODY_MAX_CHARS = 20000;

/** AI 调用超时（毫秒）：推理模型生成长 JSON 摘要（含思考过程）耗时较长，需预留充足时间 */
export const AI_TIMEOUT_MS = 120000;

/** AI 调用最大重试次数 */
export const AI_MAX_RETRIES = 3;

/** AI 摘要并发批大小 */
export const AI_BATCH_SIZE = 5;

/** 任务关联：主题相似度阈值 */
export const SUBJECT_SIMILARITY_THRESHOLD = 0.8;

/** 待办自动提取的 AI 置信度阈值 */
export const ACTION_ITEM_MIN_CONFIDENCE = 0.5;

export const CATEGORY_LABELS: Record<MailCategory, string> = {
  notification: '通知',
  task: '任务',
  meeting: '会议',
  approval: '审批',
  other: '其他',
};

/** 分类徽标配色（Tailwind 类） */
export const CATEGORY_STYLES: Record<MailCategory, { badge: string; dot: string }> = {
  notification: { badge: 'bg-sky-50 text-sky-600', dot: 'bg-sky-500' },
  task: { badge: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500' },
  meeting: { badge: 'bg-primary-50 text-primary-600', dot: 'bg-primary-500' },
  approval: { badge: 'bg-violet-50 text-violet-600', dot: 'bg-violet-500' },
  other: { badge: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

export const PRIORITY_STYLES: Record<Priority, { badge: string; text: string }> = {
  high: { badge: 'bg-red-50 text-red-600', text: 'text-red-600' },
  medium: { badge: 'bg-amber-50 text-amber-600', text: 'text-amber-600' },
  low: { badge: 'bg-gray-100 text-gray-500', text: 'text-gray-400' },
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  meeting: '会议',
  deadline: '截止日',
  reminder: '提醒',
  other: '其他',
};

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  meeting: '#3b82f6',
  deadline: '#ef4444',
  reminder: '#f59e0b',
  other: '#6b7280',
};

/** 默认提醒选项（提前分钟数） */
export const REMINDER_OPTIONS = [15, 60, 1440] as const;

export const REMINDER_LABELS: Record<number, string> = {
  15: '提前15分钟',
  60: '提前1小时',
  1440: '提前1天',
};

export const DEFAULT_IMAP_PRESET = {
  host: 'imap.example.com',
  port: 993,
  secure: true,
};

/** 邮件文件夹标识 */
export const FOLDER_INBOX = 'INBOX';
export const FOLDER_DRAFTS = 'DRAFTS';
export const FOLDER_SENT = 'SENT';

/** 默认 SMTP 发件预设（465 = SSL 直连；主机与 IMAP 不同，证书签发给 smtp.* 域名） */
export const DEFAULT_SMTP_PRESET = {
  host: 'smtp.example.com',
  port: 465,
  secure: true,
};

/** 全局字体缩放档位（小/标准/大/特大） */
export const FONT_SCALE_LEVELS = [0.85, 1, 1.15, 1.3] as const;

export const FONT_SCALE_LABELS: Record<number, string> = {
  0.85: '小',
  1: '标准',
  1.15: '大',
  1.3: '特大',
};
