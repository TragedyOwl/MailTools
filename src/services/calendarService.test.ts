import { describe, expect, it } from 'vitest';
import type { Todo } from '@/types';
import { createEventFromTodo, createEventFromMail } from './calendarService';

const baseTodo = (patch: Partial<Todo>): Todo => ({
  id: 'todo-1',
  content: '安排培训会议相关事项',
  completed: false,
  priority: 'medium',
  source: 'ai',
  createdAt: '2026-08-01T00:00:00.000Z',
  ...patch,
});

describe('createEventFromTodo', () => {
  it('should create deadline event from standard ISO deadline', () => {
    const event = createEventFromTodo(baseTodo({ deadline: '2026-08-05T10:00:00.000Z' }));
    expect(event).not.toBeNull();
    expect(event?.type).toBe('deadline');
    expect(event?.sourceTodoId).toBe('todo-1');
    expect(event?.title).toContain('安排培训会议相关事项');
  });

  it('should fallback to text extraction for Chinese deadline like 2026年8月5日 10:00', () => {
    const event = createEventFromTodo(baseTodo({ deadline: '2026年8月5日 10:00' }));
    expect(event).not.toBeNull();
    const start = new Date(event?.startTime ?? '');
    expect(Number.isNaN(start.getTime())).toBe(false);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(7);
    expect(start.getDate()).toBe(5);
  });

  it('should return null for unparseable deadline', () => {
    expect(createEventFromTodo(baseTodo({ deadline: '尽快' }))).toBeNull();
  });

  it('should return null when deadline is missing', () => {
    expect(createEventFromTodo(baseTodo({}))).toBeNull();
  });
});

describe('createEventFromMail', () => {
  it('should create meeting event when body contains meeting time', () => {
    const event = createEventFromMail({
      id: 'mail-1',
      messageId: '<m1>',
      subject: '【培训】API服务注册培训宣贯会',
      from: { name: '测试用户', email: 'user-a@example.com' },
      to: [],
      cc: [],
      date: '2026-08-04T08:00:00.000Z',
      bodyText: '会议时间：2026年8月5日 10:00\n会议地点：5楼会议室',
      attachments: [],
      flags: [],
      uid: 1,
      folder: 'INBOX',
      category: 'meeting',
      priority: 'high',
      references: [],
      createdAt: '2026-08-04T08:00:00.000Z',
      syncedAt: '2026-08-04T08:00:00.000Z',
    });
    expect(event).not.toBeNull();
    expect(event?.type).toBe('meeting');
    expect(event?.sourceMailId).toBe('mail-1');
  });

  it('should return null when no time info found', () => {
    const event = createEventFromMail({
      id: 'mail-2',
      messageId: '<m2>',
      subject: '普通通知',
      from: { name: 'A', email: 'a@test.com' },
      to: [],
      cc: [],
      date: '2026-08-04T08:00:00.000Z',
      bodyText: '请查收。',
      attachments: [],
      flags: [],
      uid: 2,
      folder: 'INBOX',
      category: 'notification',
      priority: 'low',
      references: [],
      createdAt: '2026-08-04T08:00:00.000Z',
      syncedAt: '2026-08-04T08:00:00.000Z',
    });
    expect(event).toBeNull();
  });
});
