import { format, parseISO } from 'date-fns';
import type { Mail, MailAddress } from '@/types';
import { localClassify, localPriority } from './mailParser';
import { escapeHtml, htmlToText, textToHtml } from './htmlText';
import { FOLDER_DRAFTS, FOLDER_SENT } from './constants';

/** 写信弹窗的草稿表单（字符串形式，发送/保存时再解析为结构化数据） */
export interface ComposeDraft {
  /** 草稿 ID：新建为 DRAFT-xxx，编辑已有草稿沿用原 ID */
  id: string;
  to: string;
  cc: string;
  subject: string;
  body: string;
  /** 回复时指向原邮件 Message-ID */
  inReplyTo?: string;
  /** 会话引用链 */
  references?: string[];
}

export const DRAFT_ID_PREFIX = 'DRAFT-';

export const newDraftId = (): string => `${DRAFT_ID_PREFIX}${crypto.randomUUID()}`;

export const isDraftId = (id: string): boolean => id.startsWith(DRAFT_ID_PREFIX);

/** 引用正文最大字符数（回复引用截断，避免超长） */
const QUOTE_MAX_CHARS = 2000;

/** 解析地址输入：支持逗号/分号/空白分隔的多个邮箱地址 */
export const parseAddressInput = (text: string): MailAddress[] => {
  const seen = new Set<string>();
  const result: MailAddress[] = [];
  for (const token of text.split(/[,;，；\s]+/)) {
    const trimmed = token.trim();
    if (!trimmed || !trimmed.includes('@')) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ name: trimmed.split('@')[0], email: trimmed });
  }
  return result;
};

const quoteHeader = (mail: Mail): string => {
  const time = format(parseISO(mail.date), 'yyyy-MM-dd HH:mm');
  const sender = mail.from.name ? `${mail.from.name} <${mail.from.email}>` : mail.from.email;
  return `在 ${time}，${sender} 写道：`;
};

/** 回复引用正文：优先 HTML（保留排版），无 HTML 时转安全 HTML；超长截断避免引用膨胀 */
const quoteHtml = (mail: Mail): string => {
  if (mail.bodyHtml) return mail.bodyHtml.slice(0, QUOTE_MAX_CHARS * 4);
  return textToHtml(mail.bodyText.slice(0, QUOTE_MAX_CHARS));
};

/** 新建空白草稿 */
export const createEmptyDraft = (): ComposeDraft => ({
  id: newDraftId(),
  to: '',
  cc: '',
  subject: '',
  body: '',
});

/** 回复草稿：收件人为原发件人，携带 In-Reply-To / References 以维持会话链；引用原文以 HTML 呈现 */
export const createReplyDraft = (mail: Mail): ComposeDraft => {
  const hasPrefix = /^(re:|回复：?)/i.test(mail.subject);
  const quote = `<div style="border-left:2px solid #d1d5db;padding-left:12px;color:#6b7280"><p>${escapeHtml(
    quoteHeader(mail)
  )}</p>${quoteHtml(mail)}</div>`;
  return {
    id: newDraftId(),
    to: mail.from.email,
    cc: '',
    subject: hasPrefix ? mail.subject : `Re: ${mail.subject}`,
    body: `<p><br></p>${quote}`,
    inReplyTo: mail.messageId,
    references: [...new Set([...(mail.references ?? []), mail.messageId])],
  };
};

/** 转发草稿：收件人留空，正文附带转发头与原邮件 HTML 内容 */
export const createForwardDraft = (mail: Mail): ComposeDraft => {
  const hasPrefix = /^(fwd?:|转发：?)/i.test(mail.subject);
  const time = format(parseISO(mail.date), 'yyyy-MM-dd HH:mm');
  const sender = mail.from.name ? `${mail.from.name} <${mail.from.email}>` : mail.from.email;
  const header = [
    '----- 转发的邮件 -----',
    `主题：${mail.subject}`,
    `时间：${time}`,
    `发件人：${sender}`,
    `收件人：${mail.to.map((addr) => addr.email).join(', ')}`,
  ].join('\n');
  const forwardedBody = mail.bodyHtml ? mail.bodyHtml.slice(0, QUOTE_MAX_CHARS * 8) : textToHtml(mail.bodyText.slice(0, QUOTE_MAX_CHARS * 2));
  return {
    id: newDraftId(),
    to: '',
    cc: '',
    subject: hasPrefix ? mail.subject : `Fwd: ${mail.subject}`,
    body: `<p><br></p>${textToHtml(header)}${forwardedBody}`,
  };
};

/** 已有草稿邮件 → 写信表单（用于继续编辑，正文优先 HTML） */
export const draftFromMail = (mail: Mail): ComposeDraft => ({
  id: mail.id,
  to: mail.to.map((addr) => addr.email).join(', '),
  cc: (mail.cc ?? []).map((addr) => addr.email).join(', '),
  subject: mail.subject === '(无主题)' ? '' : mail.subject,
  body: mail.bodyHtml ?? textToHtml(mail.bodyText),
  inReplyTo: mail.inReplyTo,
  references: mail.references,
});

/** 草稿表单 → 草稿箱 Mail 实体（body 为 HTML，同步提取纯文本供摘要/降级展示） */
export const buildDraftMail = (draft: ComposeDraft, selfEmail: string, nowIso: string): Mail => {
  const to = parseAddressInput(draft.to);
  const cc = parseAddressInput(draft.cc);
  const bodyHtml = draft.body;
  const bodyText = htmlToText(bodyHtml);
  return {
    id: draft.id,
    uid: 0,
    messageId: draft.id,
    subject: draft.subject.trim() || '(无主题)',
    from: { name: selfEmail.split('@')[0], email: selfEmail },
    to,
    cc: cc.length > 0 ? cc : undefined,
    date: nowIso,
    bodyText,
    bodyHtml: bodyHtml || undefined,
    attachments: [],
    flags: ['\\Draft', '\\Seen'],
    inReplyTo: draft.inReplyTo,
    references: draft.references ?? [],
    folder: FOLDER_DRAFTS,
    category: localClassify(draft.subject, bodyText),
    priority: localPriority(draft.subject, bodyText),
    createdAt: nowIso,
    syncedAt: nowIso,
  };
};

/** 草稿表单 → 已发送 Mail 实体（发送成功后入库并进入 AI 摘要流水线） */
export const buildSentMail = (params: {
  draft: ComposeDraft;
  selfEmail: string;
  messageId: string;
  nowIso: string;
}): Mail => {
  const { draft, selfEmail, messageId, nowIso } = params;
  const to = parseAddressInput(draft.to);
  const cc = parseAddressInput(draft.cc);
  const bodyHtml = draft.body;
  const bodyText = htmlToText(bodyHtml);
  return {
    id: crypto.randomUUID(),
    uid: 0,
    messageId,
    subject: draft.subject.trim() || '(无主题)',
    from: { name: selfEmail.split('@')[0], email: selfEmail },
    to,
    cc: cc.length > 0 ? cc : undefined,
    date: nowIso,
    bodyText,
    bodyHtml: bodyHtml || undefined,
    attachments: [],
    flags: ['\\Seen'],
    inReplyTo: draft.inReplyTo,
    references: draft.references ?? [],
    folder: FOLDER_SENT,
    category: localClassify(draft.subject, bodyText),
    priority: localPriority(draft.subject, bodyText),
    createdAt: nowIso,
    syncedAt: nowIso,
  };
};
