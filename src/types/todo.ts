import type { Priority } from './mail';

/** 待办事项 */
export interface Todo {
  id: string;
  content: string;
  completed: boolean;
  priority: Priority;
  deadline?: string;
  sourceMailId?: string;
  sourceTaskId?: string;
  calendarEventId?: string;
  /** 来源：ai=AI自动提取 manual=用户手动创建 */
  source: 'ai' | 'manual';
  createdAt: string;
  completedAt?: string;
}
