/** SMTP 发件服务器配置（凭据复用邮箱账号与授权码） */
export interface SmtpServerConfig {
  host: string;
  port: number;
  /** true = SSL/TLS 直连（常见端口 465），false = STARTTLS/明文（常见端口 587/25） */
  secure: boolean;
}

/** IMAP 邮箱配置（密码加密存储） */
export interface MailAccountConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  /** AES 加密后的密码 */
  encryptedPassword: string;
  /** 发件服务器（可选，用于回复/转发等发信能力） */
  smtp?: SmtpServerConfig;
}

/** AI 服务配置（Key 加密存储） */
export interface AIConfig {
  baseUrl: string;
  /** AES 加密后的 API Key */
  encryptedApiKey: string;
  model: string;
}

export type SyncIntervalMinutes = 5 | 15 | 30;

export type ThemeMode = 'light' | 'dark';

/** 应用设置 */
export interface AppSettings {
  mailAccount: MailAccountConfig | null;
  ai: AIConfig;
  syncIntervalMinutes: SyncIntervalMinutes;
  autoSyncOnOpen: boolean;
  /** 隐私模式：仅本地处理，不调用外部 AI */
  privacyMode: boolean;
  theme: ThemeMode;
  /** 全局字体缩放比例（1 = 标准，作用于根字号，rem 单位随之缩放） */
  fontScale: number;
  lastUid: number;
  /** 增量同步的时间范围（天）：默认仅同步最近 1 天，0 表示同步全部 */
  syncRangeDays: number;
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  mailAccount: null,
  ai: { baseUrl: '', encryptedApiKey: '', model: '' },
  syncIntervalMinutes: 15,
  autoSyncOnOpen: true,
  privacyMode: false,
  theme: 'light',
  fontScale: 1,
  lastUid: 0,
  syncRangeDays: 1,
  onboarded: false,
};
