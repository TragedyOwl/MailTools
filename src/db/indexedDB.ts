import Dexie, { type Table } from 'dexie';
import type { CalendarEvent, Mail, MailContact, Task, Todo } from '@/types';

/** IndexedDB 连接（Dexie） */
export class SmartMailDB extends Dexie {
  mails!: Table<Mail, string>;
  tasks!: Table<Task, string>;
  todos!: Table<Todo, string>;
  events!: Table<CalendarEvent, string>;
  contacts!: Table<MailContact, string>;

  constructor() {
    super('SmartMailDB');
    this.version(1).stores({
      mails: 'id, uid, messageId, taskId, date, category, priority',
      tasks: 'id, status, updatedAt',
      todos: 'id, completed, deadline, sourceMailId, sourceTaskId',
      events: 'id, startTime, endTime, type',
    });
    // v2：新增联系人表（地址簿自动补全）
    this.version(2).stores({
      contacts: 'email, lastUsedAt',
    });
  }
}

export const db = new SmartMailDB();
