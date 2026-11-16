import { db } from './indexedDB';
import type { Todo } from '@/types';

/** 待办仓储 */
export const todoRepository = {
  getAll: (): Promise<Todo[]> => db.todos.toArray(),

  getById: (id: string): Promise<Todo | undefined> => db.todos.get(id),

  getBySourceMail: (mailId: string): Promise<Todo[]> =>
    db.todos.where('sourceMailId').equals(mailId).toArray(),

  put: (todo: Todo): Promise<string> => db.todos.put(todo),

  bulkPut: (todos: Todo[]): Promise<string> => db.todos.bulkPut(todos).then(() => 'ok'),

  update: (id: string, patch: Partial<Todo>): Promise<number> => db.todos.update(id, patch),

  delete: (id: string): Promise<void> => db.todos.delete(id),

  clear: (): Promise<void> => db.todos.clear(),
};
