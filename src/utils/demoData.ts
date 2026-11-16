import { addDays, addHours, subDays, subHours } from 'date-fns';
import type { ActionItem, CalendarEvent, Mail, MailSummary, Task, Todo } from '@/types';
import { assignMailsToTasks } from '@/services/taskService';
import { EVENT_TYPE_COLORS } from './constants';

interface DemoData {
  mails: Mail[];
  tasks: Task[];
  todos: Todo[];
  events: CalendarEvent[];
}

const makeMail = (partial: Partial<Mail> & Pick<Mail, 'subject' | 'from' | 'date' | 'bodyText'>): Mail => {
  const nowIso = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    uid: 0,
    messageId: `demo-${crypto.randomUUID()}`,
    to: [{ name: '我', email: 'me@example.com' }],
    attachments: [],
    flags: ['\\Seen'],
    references: [],
    folder: 'INBOX',
    category: 'other',
    priority: 'medium',
    createdAt: nowIso,
    syncedAt: nowIso,
    ...partial,
  };
};

const demoSummary = (coreContent: string, keyPoints: string[], actionItems: ActionItem[]): MailSummary => ({
  coreContent,
  keyPoints,
  actionItems,
  sentiment: 'neutral',
  source: 'ai',
  generatedAt: new Date().toISOString(),
});

/** 生成演示数据：4 个任务、12 封邮件、若干待办与日程（用于无 IMAP 环境体验产品） */
export const generateDemoData = (): DemoData => {
  const now = new Date();
  const iso = (d: Date): string => d.toISOString();

  const zhangsan = { name: '张三', email: 'zhangsan@example.com' };
  const lisi = { name: '李四', email: 'lisi@example.com' };
  const wangwu = { name: '王五', email: 'wangwu@example.com' };
  const system = { name: 'OA系统', email: 'oa@example.com' };

  // ── 任务1：Q3项目进度汇报会议（引用链 3 封） ─────────────────
  const m1a = makeMail({
    subject: 'Q3项目进度汇报会议通知',
    from: zhangsan,
    date: iso(subDays(now, 2)),
    bodyText:
      '各位同事：\n定于本周五下午2点在3号楼201会议室召开Q3项目进度汇报会议，请各模块负责人准备进度PPT（10页以内）。\n请准时参加。',
    category: 'meeting',
    priority: 'high',
    summary: demoSummary(
      '本周五下午2点召开Q3项目进度汇报会议，需准备10页以内的进度PPT。',
      ['时间：本周五 14:00', '地点：3号楼201会议室', '准备材料：项目进度PPT（10页以内）'],
      [{ content: '准备Q3项目进度PPT', deadline: iso(addDays(now, 2)).slice(0, 10), assignee: undefined, confidence: 0.9 }]
    ),
  });
  const m1b = makeMail({
    subject: 'Re: Q3项目进度汇报会议通知',
    from: lisi,
    date: iso(subDays(now, 2).setHours(15, 30, 0, 0) > now.getTime() ? subHours(now, 30) : new Date(subDays(now, 2).setHours(15, 30, 0, 0))),
    bodyText: '收到。请问PPT是否需要包含风险章节？另外会议室能否接入视频会议，外部专家需要远程参加。',
    category: 'meeting',
    priority: 'medium',
    inReplyTo: m1a.messageId,
    references: [m1a.messageId],
    summary: demoSummary(
      '询问PPT是否需要包含风险章节，并确认会议室是否支持视频会议接入。',
      ['PPT内容：是否包含风险章节', '需求：会议室需支持视频会议'],
      []
    ),
  });
  const m1c = makeMail({
    subject: 'Re: Q3项目进度汇报会议通知',
    from: zhangsan,
    date: iso(subDays(now, 1)),
    bodyText: 'PPT需要包含风险与应对章节，控制在2页以内。会议室已确认支持视频会议，会议号会前一天发出。',
    category: 'meeting',
    priority: 'medium',
    inReplyTo: m1b.messageId,
    references: [m1a.messageId, m1b.messageId],
    summary: demoSummary(
      '确认PPT需包含2页以内的风险与应对章节，会议室支持视频会议，会议号提前一天发出。',
      ['PPT风险章节：2页以内', '视频会议：已确认支持'],
      []
    ),
  });

  // ── 任务2：[PROJ-2026] 核心系统升级（同发件人+项目代号 2 封） ──
  const m2a = makeMail({
    subject: '[PROJ-2026] 核心系统升级窗口申请',
    from: wangwu,
    date: iso(subDays(now, 3)),
    bodyText:
      '领导好：\n核心系统升级计划于下周六凌晨0:00-4:00进行，需申请变更窗口。升级涉及计费模块，请审批。\n回退方案已准备。',
    category: 'approval',
    priority: 'high',
    summary: demoSummary(
      '申请下周六凌晨0:00-4:00的核心系统升级变更窗口，涉及计费模块，回退方案已准备。',
      ['升级窗口：下周六 00:00-04:00', '影响模块：计费', '回退方案：已准备'],
      [{ content: '审批核心系统升级变更窗口申请', deadline: iso(addDays(now, 4)).slice(0, 10), assignee: undefined, confidence: 0.85 }]
    ),
  });
  const m2b = makeMail({
    subject: '[PROJ-2026] 核心系统升级风险评估补充',
    from: wangwu,
    date: iso(subDays(now, 1).setHours(10, 0, 0, 0) > now.getTime() ? subHours(now, 20) : new Date(subDays(now, 1).setHours(10, 0, 0, 0))),
    bodyText: '补充：升级期间计费批价将暂停约30分钟，已通知客服团队准备话术。详细风险评估见附件。',
    attachments: [{ filename: '风险评估报告.pdf', contentType: 'application/pdf', size: 245760 }],
    category: 'approval',
    priority: 'medium',
    summary: demoSummary(
      '补充升级期间计费批价将暂停约30分钟的风险评估，客服团队已准备应对话术。',
      ['影响：计费批价暂停约30分钟', '客服话术：已准备'],
      []
    ),
  });

  // ── 任务3：8月话费报销审批 ─────────────────────────────
  const m3a = makeMail({
    subject: '8月通信费用报销审批单',
    from: system,
    date: iso(subHours(now, 26)),
    bodyText: '您有一条待办审批：8月通信费用报销，金额 386.00 元。报销人：张三。请在本周内完成审批。',
    category: 'approval',
    priority: 'medium',
    summary: demoSummary(
      '8月通信费用报销待审批，金额386元，报销人张三，需本周内完成。',
      ['金额：386.00元', '报销人：张三', '时限：本周内'],
      [{ content: '完成8月通信费用报销审批', deadline: iso(addDays(now, 3)).slice(0, 10), assignee: undefined, confidence: 0.8 }]
    ),
  });

  // ── 任务4：部门周报收集 ────────────────────────────────
  const m4a = makeMail({
    subject: '关于提交本周部门周报的通知',
    from: lisi,
    date: iso(subHours(now, 8)),
    bodyText: '请各位在明天下午6点前将本周周报发给我，模板见附件。周报需包含：本周完成、下周计划、风险与问题。',
    attachments: [{ filename: '周报模板.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 18320 }],
    category: 'task',
    priority: 'medium',
    summary: demoSummary(
      '要求明天下午6点前提交本周周报，需包含本周完成、下周计划、风险与问题三部分。',
      ['截止：明天 18:00', '内容：本周完成/下周计划/风险问题'],
      [{ content: '提交本周部门周报', deadline: iso(addDays(now, 1)).slice(0, 10), assignee: undefined, confidence: 0.92 }]
    ),
  });

  // ── 未读通知类 ─────────────────────────────────────
  const m5a = makeMail({
    subject: '系统维护通知：邮件网关升级',
    from: system,
    date: iso(subHours(now, 3)),
    bodyText: '邮件网关将于本周日凌晨2:00-3:00升级维护，期间收发信可能延迟。给您带来不便敬请谅解。',
    flags: [],
    category: 'notification',
    priority: 'low',
    summary: demoSummary('邮件网关本周日凌晨2:00-3:00升级维护，期间收发信可能延迟。', ['维护窗口：周日 02:00-03:00'], []),
  });
  const m5b = makeMail({
    subject: '【重要】信息安全意识培训提醒',
    from: system,
    date: iso(subHours(now, 1)),
    bodyText: '提醒您于本月底前完成年度信息安全意识培训（在线课程约40分钟），并完成课后测验。未按时完成将影响年度合规考核。',
    flags: [],
    category: 'notification',
    priority: 'high',
    summary: demoSummary(
      '要求本月底前完成年度信息安全意识在线培训（约40分钟）及课后测验，逾期影响合规考核。',
      ['截止：本月底', '课程时长：约40分钟', '影响：年度合规考核'],
      [{ content: '完成信息安全意识培训及测验', deadline: iso(addDays(now, 10)).slice(0, 10), assignee: undefined, confidence: 0.88 }]
    ),
  });

  const mails = [m5b, m5a, m4a, m3a, m1c, m2b, m1b, m2a, m1a];

  // 任务分组（复用真实算法）
  const assignment = assignMailsToTasks(mails, [], new Date().toISOString());
  const mailsWithTask = mails.map((mail) => {
    const taskId = assignment.mailTaskMap.get(mail.id);
    return taskId ? { ...mail, taskId } : mail;
  });

  // 待办（来自演示摘要的 actionItems）
  const todos: Todo[] = [];
  for (const mail of mailsWithTask) {
    for (const item of mail.summary?.actionItems ?? []) {
      todos.push({
        id: crypto.randomUUID(),
        content: item.content,
        completed: false,
        priority: mail.priority,
        deadline: item.deadline ? `${item.deadline}T18:00:00.000Z` : undefined,
        sourceMailId: mail.id,
        sourceTaskId: mail.taskId,
        source: 'ai',
        createdAt: new Date().toISOString(),
      });
    }
  }

  // 日程
  const events: CalendarEvent[] = [
    {
      id: crypto.randomUUID(),
      title: 'Q3项目进度汇报会议',
      description: '3号楼201会议室，需准备进度PPT（含风险章节2页以内），支持视频会议。',
      startTime: iso(new Date(addDays(now, 2).setHours(14, 0, 0, 0))),
      endTime: iso(new Date(addDays(now, 2).setHours(15, 30, 0, 0))),
      allDay: false,
      type: 'meeting',
      color: EVENT_TYPE_COLORS.meeting,
      sourceMailId: m1a.id,
      reminderMinutes: [15, 60],
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      title: '截止：提交本周部门周报',
      startTime: iso(new Date(addDays(now, 1).setHours(18, 0, 0, 0))),
      endTime: iso(addHours(new Date(addDays(now, 1).setHours(18, 0, 0, 0)), 1)),
      allDay: false,
      type: 'deadline',
      color: EVENT_TYPE_COLORS.deadline,
      sourceMailId: m4a.id,
      reminderMinutes: [60, 1440],
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      title: '核心系统升级窗口（[PROJ-2026]）',
      description: '凌晨0:00-4:00，计费批价暂停约30分钟。',
      startTime: iso(new Date(addDays(now, 4).setHours(0, 0, 0, 0))),
      endTime: iso(new Date(addDays(now, 4).setHours(4, 0, 0, 0))),
      allDay: false,
      type: 'reminder',
      color: EVENT_TYPE_COLORS.reminder,
      sourceMailId: m2a.id,
      reminderMinutes: [1440],
      createdAt: new Date().toISOString(),
    },
  ];

  return { mails: mailsWithTask, tasks: assignment.touchedTasks, todos, events };
};
