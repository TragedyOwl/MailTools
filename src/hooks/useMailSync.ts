import { useEffect, useRef } from 'react';
import { useMailStore } from '@/stores/mailStore';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * 邮件同步调度：
 * - 应用打开时自动同步（可配置）
 * - 按设定间隔（5/15/30 分钟）定时同步
 */
export const useMailSync = (): void => {
  const syncIntervalMinutes = useSettingsStore((s) => s.syncIntervalMinutes);
  const autoSyncOnOpen = useSettingsStore((s) => s.autoSyncOnOpen);
  const hasAccount = useSettingsStore((s) => s.mailAccount !== null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!hasAccount) return;

    const sync = useMailStore.getState().syncMails;
    if (autoSyncOnOpen && !startedRef.current) {
      startedRef.current = true;
      void sync();
    }

    const timer = window.setInterval(() => {
      void useMailStore.getState().syncMails();
    }, syncIntervalMinutes * 60 * 1000);

    return () => window.clearInterval(timer);
  }, [hasAccount, autoSyncOnOpen, syncIntervalMinutes]);
};
