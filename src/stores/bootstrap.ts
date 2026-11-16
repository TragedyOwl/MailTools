import { mailRepository } from '@/db/mailRepository';
import { taskRepository } from '@/db/taskRepository';
import { todoRepository } from '@/db/todoRepository';
import { eventRepository } from '@/db/eventRepository';
import { contactRepository } from '@/db/contactRepository';
import { addHours } from 'date-fns';
import type { MailContact } from '@/types';
import { enrichDeadlineTime } from '@/utils/dateExtractor';
import { useMailStore } from './mailStore';
import { useTaskStore } from './taskStore';
import { useTodoStore } from './todoStore';
import { useCalendarStore } from './calendarStore';
import { useContactStore } from './contactStore';

let bootstrapped = false;

/** 应用启动时从 IndexedDB 恢复全部数据到内存 Store（仅执行一次） */
export const bootstrapApp = async (): Promise<void> => {
  if (bootstrapped) return;
  bootstrapped = true;

  const [mails, tasks, todos, events, contacts] = await Promise.all([
    mailRepository.getAll(),
    taskRepository.getAll(),
    todoRepository.getAll(),
    eventRepository.getAll(),
    contactRepository.getAll(),
  ]);

  useMailStore.getState().initFrom(mails);
  useTaskStore.getState().initFrom(tasks);
  useTodoStore.getState().initFrom(todos);
  useCalendarStore.getState().initFrom(events);
  useContactStore.getState().initFrom(contacts);

  // 联系人存量回填：历史邮件中的地址补录入地址簿（幂等，仅补录库中尚不存在的邮箱）
  const knownContact = new Set(contacts.map((contact) => contact.email));
  const seedMap = new Map<string, MailContact>();
  for (const mail of mails) {
    for (const addr of [mail.from, ...mail.to, ...(mail.cc ?? [])]) {
      const email = addr.email.trim().toLowerCase();
      if (!email || !email.includes('@') || knownContact.has(email)) continue;
      const prev = seedMap.get(email);
      seedMap.set(email, {
        email,
        name: prev?.name || addr.name.trim(),
        count: (prev?.count ?? 0) + 1,
        lastUsedAt: !prev || mail.date > prev.lastUsedAt ? mail.date : prev.lastUsedAt,
      });
    }
  }
  if (seedMap.size > 0) {
    await useContactStore.getState().seedContacts([...seedMap.values()]);
  }

  // 恢复未完成的摘要任务（隐私模式下补本地摘要；草稿不参与摘要）
  const missingSummary = mails.filter((mail) => !mail.summary && !mail.flags.includes('\\Draft')).map((mail) => mail.id);
  if (missingSummary.length > 0) {
    useMailStore.getState().enqueueSummaries(missingSummary);
  }

  // 存量截止时刻修复：旧版本 Prompt 仅要求日期，导致待办截止时间为 00:00；
  // 从来源邮件正文中回填具体时刻，并同步修正已关联的日历日程
  const mailById = new Map(mails.map((mail) => [mail.id, mail]));
  for (const todo of todos) {
    if (!todo.deadline || !todo.sourceMailId) continue;
    const original = new Date(todo.deadline);
    if (Number.isNaN(original.getTime()) || original.getHours() !== 0 || original.getMinutes() !== 0) continue;
    const mail = mailById.get(todo.sourceMailId);
    if (!mail) continue;
    const contextText = [mail.subject, mail.bodyText, ...(mail.summary?.keyPoints ?? []), mail.summary?.coreContent ?? ''].join('\n');
    const enriched = enrichDeadlineTime(todo.deadline, contextText);
    const enrichedDate = new Date(enriched);
    if (Number.isNaN(enrichedDate.getTime()) || (enrichedDate.getHours() === 0 && enrichedDate.getMinutes() === 0)) continue;
    await useTodoStore.getState().updateTodo(todo.id, { deadline: enriched });
    if (todo.calendarEventId) {
      const event = useCalendarStore.getState().events.find((item) => item.id === todo.calendarEventId);
      if (event) {
        await useCalendarStore.getState().updateEvent(event.id, {
          startTime: enrichedDate.toISOString(),
          endTime: addHours(enrichedDate, 1).toISOString(),
        });
      }
    }
  }

  // 存量入历修复：历史版本未入历的待办（有截止时间但无日历事件）补插日历（重复/无法解析由内部拦截）
  const pendingCalendarTodos = todos.filter((todo) => todo.deadline && !todo.calendarEventId);
  for (const todo of pendingCalendarTodos) {
    await useTodoStore.getState().addToCalendar(todo.id);
  }

  // 存量入历修复：会议类邮件无关联日程时，基于正文时间信息补建日程（同邮件已有事件时内部跳过）
  const meetingMailsWithoutEvent = mails.filter(
    (mail) => mail.category === 'meeting' && !mail.flags.includes('\\Draft') && !events.some((event) => event.sourceMailId === mail.id)
  );
  for (const mail of meetingMailsWithoutEvent) {
    await useCalendarStore.getState().addEventFromMail(mail);
  }
};
