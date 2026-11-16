import { useEffect } from 'react';
import { useCalendarStore } from '@/stores/calendarStore';
import { checkEventReminders } from '@/services/notificationService';

/** 日历事件提醒调度：每 30 秒检查一次即将开始的日程并触发浏览器通知 */
export const useReminders = (): void => {
  useEffect(() => {
    const check = (): void => {
      checkEventReminders(useCalendarStore.getState().events);
    };

    check();
    const timer = window.setInterval(check, 30 * 1000);
    return () => window.clearInterval(timer);
  }, []);
};
