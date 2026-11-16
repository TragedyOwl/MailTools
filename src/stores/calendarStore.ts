import { create } from 'zustand';
import type { CalendarEvent, CalendarViewMode, Mail } from '@/types';
import { eventRepository } from '@/db/eventRepository';
import { createEventFromMail } from '@/services/calendarService';

interface CalendarState {
  events: CalendarEvent[];
  viewMode: CalendarViewMode;
  /** 当前视图锚定日期（ISO 日期字符串） */
  anchorDate: string;
  /** 跳转定位目标：从邮件摘要等处跳转到日历时打开该日程 */
  focusEventId: string | null;

  initFrom: (events: CalendarEvent[]) => void;
  setFocusEvent: (id: string | null) => void;
  addEvent: (event: CalendarEvent) => Promise<CalendarEvent>;
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
  /** 基于邮件时间信息自动创建日程（同邮件已存在事件或无时间信息时跳过） */
  addEventFromMail: (mail: Mail) => Promise<CalendarEvent | null>;
  setViewMode: (mode: CalendarViewMode) => void;
  setAnchorDate: (iso: string) => void;
  reset: () => Promise<void>;
}

export const useCalendarStore = create<CalendarState>()((set, get) => ({
  events: [],
  viewMode: 'month',
  anchorDate: new Date().toISOString(),
  focusEventId: null,

  initFrom: (events) => set({ events }),

  setFocusEvent: (id) => set({ focusEventId: id }),

  addEvent: async (event) => {
    await eventRepository.put(event);
    set({ events: [...get().events, event] });
    return event;
  },

  updateEvent: async (id, patch) => {
    await eventRepository.update(id, patch);
    set({ events: get().events.map((event) => (event.id === id ? { ...event, ...patch } : event)) });
  },

  removeEvent: async (id) => {
    await eventRepository.delete(id);
    set({ events: get().events.filter((event) => event.id !== id) });
  },

  addEventFromMail: async (mail) => {
    // 去重：同一邮件已关联事件时不重复创建
    if (get().events.some((event) => event.sourceMailId === mail.id)) return null;
    const event = createEventFromMail(mail);
    if (!event) return null;
    await eventRepository.put(event);
    set({ events: [...get().events, event] });
    return event;
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  setAnchorDate: (iso) => set({ anchorDate: iso }),

  reset: async () => {
    await eventRepository.clear();
    set({ events: [] });
  },
}));
