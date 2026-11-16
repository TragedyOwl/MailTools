import { db } from './indexedDB';
import type { Task } from '@/types';

/** 任务仓储 */
export const taskRepository = {
  getAll: (): Promise<Task[]> => db.tasks.orderBy('updatedAt').reverse().toArray(),

  getById: (id: string): Promise<Task | undefined> => db.tasks.get(id),

  put: (task: Task): Promise<string> => db.tasks.put(task),

  bulkPut: (tasks: Task[]): Promise<string> => db.tasks.bulkPut(tasks).then(() => 'ok'),

  update: (id: string, patch: Partial<Task>): Promise<number> => db.tasks.update(id, patch),

  delete: (id: string): Promise<void> => db.tasks.delete(id),

  clear: (): Promise<void> => db.tasks.clear(),
};
