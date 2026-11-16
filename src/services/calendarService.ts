import { addDays, addHours, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns';
import type { CalendarEvent, EventType, Mail, Todo } from '@/types';
import { EVENT_TYPE_COLORS } from '@/utils/constants';
import { extractDates } from '@/utils/dateExtractor';

/** 生成月视图 6x7 网格（42 天，周一为一周开始） */
export const buildMonthGrid = (anchor: Date): Date[] => {
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
  const days: Date[] = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  // 固定 42 格
  while (days.length < 42) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days.slice(0, 42);
};

const newEventId = (): string => `EVT-${crypto.randomUUID()}`;

const baseEvent = (partial: Partial<CalendarEvent> & Pick<CalendarEvent, 'title' | 'startTime' | 'endTime' | 'type'>): CalendarEvent => ({
  id: newEventId(),
  description: undefined,
  allDay: false,
  color: EVENT_TYPE_COLORS[partial.type],
  reminderMinutes: [15],
  createdAt: new Date().toISOString(),
  ...partial,
});

/** 从邮件预填充日历事件（提取正文时间信息；无时间信息返回 null） */
export const createEventFromMail = (mail: Mail): CalendarEvent | null => {
  const dates = extractDates(`${mail.subject}\n${mail.bodyText}`);
  if (dates.length === 0) return null;

  const type: EventType = mail.category === 'meeting' ? 'meeting' : 'reminder';
  return baseEvent({
    title: mail.subject,
    description: mail.summary?.coreContent ?? mail.bodyText.slice(0, 300),
    startTime: dates[0],
    endTime: addHours(new Date(dates[0]), 1).toISOString(),
    type,
    sourceMailId: mail.id,
    reminderMinutes: type === 'meeting' ? [15, 60] : [15],
  });
};

/** 从待办创建截止日事件（deadline 无法解析时尝试文本日期提取，仍失败则返回 null） */
export const createEventFromTodo = (todo: Todo): CalendarEvent | null => {
  if (!todo.deadline) return null;
  let start = new Date(todo.deadline);
  if (Number.isNaN(start.getTime())) {
    // 容错：AI 可能返回非标准格式（如“2026年8月5日”“本周五”），尝试文本提取
    const fallback = extractDates(todo.deadline, undefined, 1)[0];
    if (!fallback) return null;
    start = new Date(fallback);
  }
  return baseEvent({
    title: `截止：${todo.content}`,
    startTime: start.toISOString(),
    endTime: addHours(start, 1).toISOString(),
    type: 'deadline',
    sourceMailId: todo.sourceMailId,
    sourceTodoId: todo.id,
    reminderMinutes: [60, 1440],
  });
};

/** 解析日程关联的邮件 ID：优先事件自身来源邮件，其次回溯来源待办的邮件（兼容历史数据） */
export const resolveEventMailId = (event: CalendarEvent, todos: Todo[]): string | undefined => {
  if (event.sourceMailId) return event.sourceMailId;
  if (event.sourceTodoId) {
    return todos.find((todo) => todo.id === event.sourceTodoId)?.sourceMailId;
  }
  return undefined;
};

/** 判断事件是否落在指定日期内 */
export const eventOnDay = (event: CalendarEvent, day: Date): boolean => {
  const start = new Date(event.startTime);
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = addDays(dayStart, 1);
  return start < dayEnd && new Date(event.endTime) > dayStart;
};

/** 周/日视图事件布局：为重叠事件分配并列栏位 */
export interface EventLayout {
  event: CalendarEvent;
  /** 0-1 之间的位置与尺寸（相对时间轴） */
  top: number;
  height: number;
  lane: number;
  laneCount: number;
}

export const layoutDayEvents = (events: CalendarEvent[], dayStartHour = 0, dayEndHour = 24): EventLayout[] => {
  const rangeMinutes = (dayEndHour - dayStartHour) * 60;
  const timed = events
    .filter((e) => !e.allDay)
    .map((event) => {
      const start = new Date(event.startTime);
      const end = new Date(event.endTime);
      const startMinutes = Math.max(0, (start.getHours() - dayStartHour) * 60 + start.getMinutes());
      const endMinutes = Math.min(rangeMinutes, (end.getHours() - dayStartHour) * 60 + end.getMinutes());
      return { event, startMinutes, endMinutes: Math.max(endMinutes, startMinutes + 30) };
    })
    .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);

  // 简单分栏：遍历事件，放入第一个不冲突的栏
  const lanes: number[] = []; // 每栏当前最晚结束分钟
  const layouts: EventLayout[] = [];
  let maxLane = 0;

  for (const item of timed) {
    let lane = lanes.findIndex((end) => end <= item.startMinutes);
    if (lane === -1) {
      lane = lanes.length;
      lanes.push(0);
    }
    lanes[lane] = item.endMinutes;
    maxLane = Math.max(maxLane, lane + 1);
    layouts.push({
      event: item.event,
      top: item.startMinutes / rangeMinutes,
      height: (item.endMinutes - item.startMinutes) / rangeMinutes,
      lane,
      laneCount: 1,
    });
  }

  return layouts.map((layout) => ({ ...layout, laneCount: Math.max(maxLane, 1) }));
};
