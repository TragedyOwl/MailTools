import { create } from 'zustand';
import type { Mail, Priority, Todo } from '@/types';
import { todoRepository } from '@/db/todoRepository';
import { createEventFromTodo } from '@/services/calendarService';
import { ACTION_ITEM_MIN_CONFIDENCE } from '@/utils/constants';
import { enrichDeadlineTime } from '@/utils/dateExtractor';
import { useCalendarStore } from './calendarStore';

interface AddTodoInput {
  content: string;
  priority: Priority;
  deadline?: string;
  sourceMailId?: string;
  sourceTaskId?: string;
  source: 'ai' | 'manual';
}

interface TodoState {
  todos: Todo[];
  /** 跳转定位目标：从邮件摘要等处跳转到待办页时高亮滚动到该待办 */
  focusTodoId: string | null;

  initFrom: (todos: Todo[]) => void;
  setFocus: (id: string | null) => void;
  addTodo: (input: AddTodoInput) => Promise<Todo>;
  toggle: (id: string) => Promise<void>;
  updateTodo: (id: string, patch: Partial<Todo>) => Promise<void>;
  removeTodo: (id: string) => Promise<void>;
  /** 从邮件 AI 摘要的 actionItems 自动创建待办（去重），返回创建数量 */
  addFromActionItems: (mail: Mail) => Promise<number>;
  /** 将待办插入日历（基于截止时间），返回是否成功 */
  addToCalendar: (id: string) => Promise<boolean>;
  reset: () => Promise<void>;
}

const newTodo = (input: AddTodoInput): Todo => ({
  id: crypto.randomUUID(),
  content: input.content,
  completed: false,
  priority: input.priority,
  deadline: input.deadline,
  sourceMailId: input.sourceMailId,
  sourceTaskId: input.sourceTaskId,
  source: input.source,
  createdAt: new Date().toISOString(),
});

export const useTodoStore = create<TodoState>()((set, get) => ({
  todos: [],
  focusTodoId: null,

  initFrom: (todos) => set({ todos }),

  setFocus: (id) => set({ focusTodoId: id }),

  addTodo: async (input) => {
    const todo = newTodo(input);
    await todoRepository.put(todo);
    set({ todos: [todo, ...get().todos] });
    return todo;
  },

  toggle: async (id) => {
    const todo = get().todos.find((item) => item.id === id);
    if (!todo) return;
    const patch: Partial<Todo> = {
      completed: !todo.completed,
      completedAt: !todo.completed ? new Date().toISOString() : undefined,
    };
    await todoRepository.update(id, patch);
    set({ todos: get().todos.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  },

  updateTodo: async (id, patch) => {
    await todoRepository.update(id, patch);
    set({ todos: get().todos.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  },

  removeTodo: async (id) => {
    await todoRepository.delete(id);
    set({ todos: get().todos.filter((item) => item.id !== id) });
  },

  addFromActionItems: async (mail) => {
    const items = mail.summary?.actionItems ?? [];
    if (items.length === 0) return 0;

    // 时刻补全上下文：AI 常只返回日期，需从邮件正文中回填具体时刻（如 10:40）
    const contextText = [
      mail.subject,
      mail.bodyText,
      ...(mail.summary?.keyPoints ?? []),
      mail.summary?.coreContent ?? '',
    ].join('\n');

    const existingKeys = new Set(
      get().todos.map((todo) => `${todo.sourceMailId ?? ''}|${todo.content}`)
    );

    let created = 0;
    for (const item of items) {
      if (item.confidence < ACTION_ITEM_MIN_CONFIDENCE) continue;
      const key = `${mail.id}|${item.content}`;
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      await get().addTodo({
        content: item.content,
        priority: mail.priority,
        deadline: item.deadline ? enrichDeadlineTime(item.deadline, contextText) : undefined,
        sourceMailId: mail.id,
        sourceTaskId: mail.taskId,
        source: 'ai',
      });
      created++;
    }
    return created;
  },

  addToCalendar: async (id) => {
    const todo = get().todos.find((item) => item.id === id);
    if (!todo) return false;
    if (todo.calendarEventId) return true; // 已插入过

    const event = createEventFromTodo(todo);
    if (!event) return false;

    await useCalendarStore.getState().addEvent(event);
    await get().updateTodo(id, { calendarEventId: event.id });
    return true;
  },

  reset: async () => {
    await todoRepository.clear();
    set({ todos: [] });
  },
}));
