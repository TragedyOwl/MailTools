import { db } from './indexedDB';
import type { CalendarEvent } from '@/types';

/** 日历事件仓储 */
export const eventRepository = {
  getAll: (): Promise<CalendarEvent[]> => db.events.toArray(),

  getById: (id: string): Promise<CalendarEvent | undefined> => db.events.get(id),

  getBySourceTodo: (todoId: string): Promise<CalendarEvent[]> =>
    db.events.filter((event) => event.sourceTodoId === todoId).toArray(),

  put: (event: CalendarEvent): Promise<string> => db.events.put(event),

  update: (id: string, patch: Partial<CalendarEvent>): Promise<number> => db.events.update(id, patch),

  delete: (id: string): Promise<void> => db.events.delete(id),

  clear: (): Promise<void> => db.events.clear(),
};
