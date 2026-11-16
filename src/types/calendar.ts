/** 日历事件类型 */
export type EventType = 'meeting' | 'deadline' | 'reminder' | 'other';

/** 日历事件 */
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  type: EventType;
  color: string;
  sourceMailId?: string;
  sourceTodoId?: string;
  reminderMinutes: number[];
  createdAt: string;
}

export type CalendarViewMode = 'month' | 'week' | 'day';
