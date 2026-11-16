import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings, SmtpServerConfig, SyncIntervalMinutes, ThemeMode } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import { decryptCredential, encryptCredential } from '@/utils/crypto';
import type { ImapAccountInput } from '@/services/mailService';
import type { AIClientConfig } from '@/services/aiService';

interface MailAccountInput {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  /** 发件服务器（可选） */
  smtp?: SmtpServerConfig;
}

interface AIConfigInput {
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface SettingsState extends AppSettings {
  setMailAccount: (account: MailAccountInput) => void;
  clearMailAccount: () => void;
  setAIConfig: (config: AIConfigInput) => void;
  setSyncInterval: (minutes: SyncIntervalMinutes) => void;
  setAutoSyncOnOpen: (enabled: boolean) => void;
  setPrivacyMode: (enabled: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
  /** 设置全局字体缩放比例（取 FONT_SCALE_LEVELS 档位） */
  setFontScale: (scale: number) => void;
  setLastUid: (uid: number) => void;
  /** 设置增量同步时间范围（天），0 表示全部 */
  setSyncRangeDays: (days: number) => void;
  setOnboarded: () => void;
  /** 获取解密后的邮箱账号（用于发起同步） */
  getDecryptedAccount: () => ImapAccountInput | null;
  /** 获取解密后的 AI 配置（未配置返回 undefined，服务端将使用环境变量） */
  getDecryptedAI: () => AIClientConfig | undefined;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,

      setMailAccount: (account) =>
        set({
          mailAccount: {
            host: account.host,
            port: account.port,
            secure: account.secure,
            user: account.user,
            encryptedPassword: encryptCredential(account.password),
            smtp: account.smtp,
          },
          lastUid: 0,
        }),

      clearMailAccount: () => set({ mailAccount: null, lastUid: 0 }),

      setAIConfig: (config) =>
        set({
          ai: {
            baseUrl: config.baseUrl,
            model: config.model,
            encryptedApiKey: config.apiKey ? encryptCredential(config.apiKey) : '',
          },
        }),

      setSyncInterval: (minutes) => set({ syncIntervalMinutes: minutes }),
      setAutoSyncOnOpen: (enabled) => set({ autoSyncOnOpen: enabled }),
      setPrivacyMode: (enabled) => set({ privacyMode: enabled }),
      setTheme: (theme) => set({ theme }),
      setFontScale: (scale) => set({ fontScale: scale }),
      setLastUid: (uid) => set({ lastUid: uid }),
      setSyncRangeDays: (days) => set({ syncRangeDays: days }),
      setOnboarded: () => set({ onboarded: true }),

      getDecryptedAccount: () => {
        const account = get().mailAccount;
        if (!account) return null;
        const password = decryptCredential(account.encryptedPassword);
        if (!password) return null;
        return {
          host: account.host,
          port: account.port,
          secure: account.secure,
          user: account.user,
          password,
          smtp: account.smtp,
        };
      },

      getDecryptedAI: () => {
        const ai = get().ai;
        const apiKey = ai.encryptedApiKey ? decryptCredential(ai.encryptedApiKey) : '';
        if (!ai.baseUrl || !apiKey || !ai.model) return undefined;
        return { baseUrl: ai.baseUrl, apiKey, model: ai.model };
      },

      resetSettings: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: 'sma-settings',
      version: 1,
      partialize: (state) => ({
        mailAccount: state.mailAccount,
        ai: state.ai,
        syncIntervalMinutes: state.syncIntervalMinutes,
        autoSyncOnOpen: state.autoSyncOnOpen,
        privacyMode: state.privacyMode,
        theme: state.theme,
        fontScale: state.fontScale,
        lastUid: state.lastUid,
        syncRangeDays: state.syncRangeDays,
        onboarded: state.onboarded,
      }),
    }
  )
);
