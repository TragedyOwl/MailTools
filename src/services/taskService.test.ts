import { describe, expect, it } from 'vitest';
import type { Mail, Task } from '@/types';
import { assignMailsToTasks, mergeTaskList } from './taskService';

const NOW = '2026-07-29T03:00:00.000Z';

let seq = 0;
const makeMail = (partial: Partial<Mail>): Mail => {
  seq += 1;
  return {
    id: `m${seq}`,
    uid: seq,
    messageId: `<msg-${seq}@x.com>`,
    subject: '测试主题',
    from: { name: '张三', email: 'zhangsan@x.com' },
    to: [],
    date: `2026-07-0${Math.min(seq, 9)}T10:00:00.000Z`,
    bodyText: '正文',
    attachments: [],
    flags: ['\\Seen'],
    references: [],
    folder: 'INBOX',
    category: 'other',
    priority: 'medium',
    createdAt: NOW,
    syncedAt: NOW,
    ...partial,
  };
};

describe('assignMailsToTasks', () => {
  it('规则1：In-Reply-To / References 引用链归为同一任务', () => {
    const m1 = makeMail({ subject: '项目进度汇报会议通知' });
    const m2 = makeMail({ subject: 'Re: 项目进度汇报会议通知', inReplyTo: m1.messageId, references: [m1.messageId] });
    const m3 = makeMail({ subject: '完全不同的另一件事' });

    const { touchedTasks, mailTaskMap } = assignMailsToTasks([m1, m2, m3], [], NOW);

    expect(touchedTasks).toHaveLength(2);
    const meetingTask = touchedTasks.find((t) => t.mailCount === 2);
    expect(meetingTask).toBeDefined();
    expect(meetingTask?.mailIds).toContain(m1.id);
    expect(meetingTask?.mailIds).toContain(m2.id);
    expect(mailTaskMap.get(m1.id)).toBe(meetingTask?.id);
    expect(mailTaskMap.get(m2.id)).toBe(meetingTask?.id);
  });

  it('规则2：主题相似度 >= 0.8 归为同一任务（无引用头）', () => {
    const m1 = makeMail({ subject: 'Q3项目进度汇报会议通知' });
    const m2 = makeMail({ subject: 'Re: Q3项目进度汇报会议通知' }); // 清洗后完全相同

    const { touchedTasks } = assignMailsToTasks([m1, m2], [], NOW);
    expect(touchedTasks).toHaveLength(1);
    expect(touchedTasks[0].mailCount).toBe(2);
  });

  it('规则3：同一发件人 + 相同项目代号归为同一任务（主题不相似）', () => {
    const m1 = makeMail({ subject: '[PROJ-100] 核心系统升级窗口申请' });
    const m2 = makeMail({ subject: '【PROJ-100】风险评估补充材料' });
    const m3 = makeMail({ subject: '[OTHER-9] 无关事项', from: { name: '李四', email: 'lisi@x.com' } });

    const { touchedTasks } = assignMailsToTasks([m1, m2, m3], [], NOW);
    const projTask = touchedTasks.find((t) => t.mailCount === 2);
    expect(projTask).toBeDefined();
    expect(projTask?.mailIds).toContain(m1.id);
    expect(projTask?.mailIds).toContain(m2.id);
  });

  it('不同发件人即使项目代号相同也不归并', () => {
    // 主题后缀足够长且不同，确保规则2（主题相似度）不触发，单独验证规则3的发件人约束
    const m1 = makeMail({ subject: '[PROJ-100] 升级窗口申请审批流程说明', from: { name: '张三', email: 'zhangsan@x.com' } });
    const m2 = makeMail({ subject: '[PROJ-100] 风险评估报告补充材料汇总', from: { name: '李四', email: 'lisi@x.com' } });

    const { touchedTasks } = assignMailsToTasks([m1, m2], [], NOW);
    const total = touchedTasks.reduce((sum, t) => sum + t.mailCount, 0);
    expect(total).toBe(2);
    expect(touchedTasks.every((t) => t.mailCount === 1)).toBe(true);
  });

  it('无关联邮件各自独立成任务', () => {
    const m1 = makeMail({ subject: '系统维护通知' });
    const m2 = makeMail({ subject: '部门团建活动报名' });

    const { touchedTasks } = assignMailsToTasks([m1, m2], [], NOW);
    expect(touchedTasks).toHaveLength(2);
    expect(touchedTasks.every((t) => t.mailCount === 1)).toBe(true);
  });

  it('已有任务归属被复用，新邮件加入该任务', () => {
    const m1 = makeMail({ subject: '报销审批单', taskId: 'TASK-EXIST' });
    const m2 = makeMail({ subject: 'Re: 报销审批单', inReplyTo: m1.messageId });

    const existing: Task = {
      id: 'TASK-EXIST',
      title: '报销审批单',
      status: 'active',
      mailIds: [m1.id],
      category: 'approval',
      priority: 'medium',
      createdAt: NOW,
      updatedAt: m1.date,
      mailCount: 1,
      unreadCount: 0,
    };

    const { touchedTasks, mailTaskMap } = assignMailsToTasks([m1, m2], [existing], NOW);
    expect(touchedTasks).toHaveLength(1);
    expect(touchedTasks[0].id).toBe('TASK-EXIST');
    expect(touchedTasks[0].mailCount).toBe(2);
    expect(mailTaskMap.get(m2.id)).toBe('TASK-EXIST');
  });

  it('任务标题取首封邮件的清洗主题，updatedAt 取最新邮件时间', () => {
    const m1 = makeMail({ subject: 'Q3项目进度汇报会议通知', date: '2026-07-01T10:00:00.000Z' });
    const m2 = makeMail({ subject: 'Re: Q3项目进度汇报会议通知', date: '2026-07-05T10:00:00.000Z', inReplyTo: m1.messageId });

    const { touchedTasks } = assignMailsToTasks([m2, m1], [], NOW);
    expect(touchedTasks[0].title).toBe('q3项目进度汇报会议通知');
    expect(touchedTasks[0].updatedAt).toBe('2026-07-05T10:00:00.000Z');
  });

  it('未读邮件计入 unreadCount', () => {
    const m1 = makeMail({ subject: '信息安全培训提醒', flags: [] });
    const m2 = makeMail({ subject: 'Re: 信息安全培训提醒', flags: ['\\Seen'], inReplyTo: m1.messageId });

    const { touchedTasks } = assignMailsToTasks([m1, m2], [], NOW);
    expect(touchedTasks[0].unreadCount).toBe(1);
  });
});

describe('mergeTaskList', () => {
  const makeTask = (id: string, mailIds: string[], unread: number): Task => ({
    id,
    title: `任务${id}`,
    status: 'active',
    mailIds,
    category: 'other',
    priority: 'medium',
    createdAt: NOW,
    updatedAt: NOW,
    mailCount: mailIds.length,
    unreadCount: unread,
  });

  it('保留邮件数最多的任务，合并邮件并去重', () => {
    const t1 = makeTask('T1', ['m1', 'm2'], 1);
    const t2 = makeTask('T2', ['m3'], 0);
    const t3 = makeTask('T3', ['m2', 'm4'], 2);

    const { merged, removedIds } = mergeTaskList([t1, t2, t3], ['T1', 'T2', 'T3'], NOW);
    expect(merged.id).toBe('T1');
    expect(merged.mailIds.sort()).toEqual(['m1', 'm2', 'm3', 'm4']);
    expect(merged.mailCount).toBe(4);
    expect(merged.unreadCount).toBe(3);
    expect(merged.summary).toBeUndefined();
    expect(removedIds.sort()).toEqual(['T2', 'T3']);
  });

  it('少于两个任务时抛错', () => {
    const t1 = makeTask('T1', ['m1'], 0);
    expect(() => mergeTaskList([t1], ['T1'], NOW)).toThrow();
  });
});
