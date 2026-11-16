import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { bootstrapApp } from '@/stores/bootstrap';
import { useSettingsStore } from '@/stores/settingsStore';
import { useMailSync } from '@/hooks/useMailSync';
import { useAISummary } from '@/hooks/useAISummary';
import { useReminders } from '@/hooks/useReminders';
import { useTheme } from '@/hooks/useTheme';
import { MainLayout } from '@/components/layout/MainLayout';
import { InboxPage } from '@/pages/InboxPage';
import { TaskPage } from '@/pages/TaskPage';
import { TodoPage } from '@/pages/TodoPage';
import { CalendarPage } from '@/pages/CalendarPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { OnboardingModal } from '@/components/common/OnboardingModal';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

/** 应用主体：路由 + 全局后台任务 Hooks */
const AppShell = () => {
  useTheme();
  useMailSync();
  useAISummary();
  useReminders();

  const onboarded = useSettingsStore((s) => s.onboarded);

  return (
    <>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<InboxPage />} />
          <Route path="drafts" element={<InboxPage folder="DRAFTS" />} />
          <Route path="sent" element={<InboxPage folder="SENT" />} />
          <Route path="tasks" element={<TaskPage />} />
          <Route path="todos" element={<TodoPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      {!onboarded && <OnboardingModal />}
    </>
  );
};

export const App = () => {
  const [ready, setReady] = useState(false);

  // 启动时从 IndexedDB 恢复数据
  useEffect(() => {
    let cancelled = false;
    void bootstrapApp().finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-soft dark:bg-ink-charcoal">
        <LoadingSpinner text="正在加载本地数据…" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
};
