import type { CalendarEvent } from '@/types';

const NOTIFIED_KEY = 'sma-notified-events';

const loadNotified = (): Set<string> => {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
};

const saveNotified = (set: Set<string>): void => {
  // 仅保留最近 500 条，避免无限增长
  const list = [...set].slice(-500);
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(list));
};

/** 浏览器通知是否可用且已授权 */
export const notificationAllowed = (): boolean =>
  typeof Notification !== 'undefined' && Notification.permission === 'granted';

/** 请求通知权限，返回是否已授权 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
};

/**
 * 检查事件提醒：对即将到达提醒时间点的事件弹出浏览器通知。
 * 每个事件的每个提醒档位仅通知一次（localStorage 去重）。
 */
export const checkEventReminders = (events: CalendarEvent[], now: Date = new Date()): number => {
  if (!notificationAllowed()) return 0;

  const notified = loadNotified();
  let fired = 0;

  for (const event of events) {
    const start = new Date(event.startTime).getTime();
    if (start < now.getTime() - 60 * 1000) continue; // 已开始超过1分钟不再提醒

    for (const minutes of event.reminderMinutes) {
      const key = `${event.id}:${minutes}`;
      if (notified.has(key)) continue;

      const remindAt = start - minutes * 60 * 1000;
      if (now.getTime() >= remindAt && now.getTime() < start + 5 * 60 * 1000) {
        const label = minutes >= 1440 ? `${Math.round(minutes / 1440)} 天后` : minutes >= 60 ? `${Math.round(minutes / 60)} 小时后` : `${minutes} 分钟后`;
        new Notification(`日程提醒：${event.title}`, {
          body: `${label}开始（${new Date(event.startTime).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}）`,
          tag: key,
        });
        notified.add(key);
        fired++;
      }
    }
  }

  if (fired > 0) saveNotified(notified);
  return fired;
};
