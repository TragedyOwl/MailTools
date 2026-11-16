import type { Mail, MailCategory, Priority, RawMail } from '@/types';
import { MAIL_BODY_MAX_CHARS } from './constants';

/** HTML 转纯文本（保留基本换行结构） */
export const htmlToText = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** 截断文本 */
export const truncate = (text: string, maxLength: number): string =>
  text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;

/** 列表预览文本：压缩空白后截断 */
export const previewText = (text: string, maxLength = 80): string =>
  truncate(text.replace(/\s+/g, ' ').trim(), maxLength);

/**
 * 本地规则降级分类（AI 不可用或隐私模式时使用）
 * 主题含"会议"→meeting，含"申请/审批"→approval，含"通知/公告"→notification
 */
export const localClassify = (subject: string, body: string): MailCategory => {
  const text = `${subject} ${body.slice(0, 200)}`;
  if (/会议|例会|研讨会|宣贯会|培训会|评审会|启动会|视频会|电话会|meeting/i.test(text)) return 'meeting';
  if (/审批|申请|请示|报销|approve|approval/i.test(text)) return 'approval';
  if (/任务|待办|请处理|请查收并|工作安排|todo|action item/i.test(text)) return 'task';
  if (/通知|公告|通告|周报|日报|月报|notification|newsletter/i.test(text)) return 'notification';
  return 'other';
};

/** 本地规则降级优先级判断 */
export const localPriority = (subject: string, body: string): Priority => {
  const text = `${subject} ${body.slice(0, 300)}`;
  if (/紧急|加急|urgent|asap|尽快|立即|今天截止|务必/i.test(text)) return 'high';
  if (/本周|这周|近期|重要/i.test(text)) return 'medium';
  return 'low';
};

const normalizeAddress = (addr: { name: string; email: string }): { name: string; email: string } => ({
  name: addr.name || addr.email.split('@')[0],
  email: addr.email,
});

/** 服务端 RawMail → 客户端 Mail 实体 */
export const rawToMail = (raw: RawMail, nowIso: string): Mail => {
  const bodyText = truncate(raw.bodyText || (raw.bodyHtml ? htmlToText(raw.bodyHtml) : ''), MAIL_BODY_MAX_CHARS);
  const bodyHtml = raw.bodyHtml ? truncate(raw.bodyHtml, MAIL_BODY_MAX_CHARS * 2) : undefined;

  return {
    id: crypto.randomUUID(),
    uid: raw.uid,
    messageId: raw.messageId || `uid-${raw.uid}`,
    subject: raw.subject || '(无主题)',
    from: normalizeAddress(raw.from),
    to: (raw.to ?? []).map(normalizeAddress),
    cc: raw.cc?.map(normalizeAddress),
    date: raw.date,
    bodyText,
    bodyHtml,
    attachments: raw.attachments ?? [],
    flags: raw.flags ?? [],
    inReplyTo: raw.inReplyTo,
    references: raw.references ?? [],
    folder: raw.folder || 'INBOX',
    category: localClassify(raw.subject ?? '', bodyText),
    priority: localPriority(raw.subject ?? '', bodyText),
    createdAt: nowIso,
    syncedAt: nowIso,
  };
};
