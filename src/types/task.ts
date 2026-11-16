import type { MailCategory, Priority } from './mail';

/** 任务状态 */
export type TaskStatus = 'active' | 'completed' | 'archived';

/** 任务（同主题邮件的归档单元） */
export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  mailIds: string[];
  summary?: string;
  category: MailCategory;
  priority: Priority;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;

  mailCount: number;
  unreadCount: number;
}
