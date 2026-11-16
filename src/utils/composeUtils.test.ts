import { describe, expect, it } from 'vitest';
import type { Mail } from '@/types';
import {
  buildDraftMail,
  buildSentMail,
  createEmptyDraft,
  createForwardDraft,
  createReplyDraft,
  isDraftId,
  parseAddressInput,
} from './composeUtils';
import { FOLDER_DRAFTS, FOLDER_SENT } from './constants';

const baseMail: Mail = {
  id: 'M-1',
  uid: 10,
  messageId: '<original@example.com>',
  subject: '项目进度同步',
  from: { name: '张三', email: 'zhangsan@example.com' },
  to: [{ name: 'me', email: 'me@example.com' }],
  date: '2026-08-04T08:00:00.000Z',
  bodyText: '请在本周五前提交报告',
  attachments: [],
  flags: [],
  references: ['<ref-1@example.com>'],
  folder: 'INBOX',
  category: 'task',
  priority: 'medium',
  createdAt: '2026-08-04T08:00:00.000Z',
  syncedAt: '2026-08-04T08:00:00.000Z',
};

describe('parseAddressInput', () => {
  it('should parse multiple addresses separated by comma/semicolon/whitespace', () => {
    const result = parseAddressInput('a@x.com, b@x.com；c@x.com d@x.com');
    expect(result.map((addr) => addr.email)).toEqual(['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com']);
  });

  it('should skip invalid tokens and deduplicate case-insensitively', () => {
    const result = parseAddressInput('a@x.com, 无效内容, A@X.com');
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('a@x.com');
  });
});

describe('createReplyDraft', () => {
  it('should prefill recipient, Re: subject and conversation headers', () => {
    const draft = createReplyDraft(baseMail);
    expect(draft.to).toBe('zhangsan@example.com');
    expect(draft.subject).toBe('Re: 项目进度同步');
    expect(draft.inReplyTo).toBe('<original@example.com>');
    expect(draft.references).toContain('<ref-1@example.com>');
    expect(draft.references).toContain('<original@example.com>');
    // 引用原文以 HTML 呈现（带引用头与原文内容）
    expect(draft.body).toContain('写道：');
    expect(draft.body).toContain('请在本周五前提交报告');
    expect(draft.body).toContain('<div');
    expect(isDraftId(draft.id)).toBe(true);
  });

  it('should not duplicate Re: prefix', () => {
    const draft = createReplyDraft({ ...baseMail, subject: 'Re: 项目进度同步' });
    expect(draft.subject).toBe('Re: 项目进度同步');
  });
});

describe('createForwardDraft', () => {
  it('should prefill Fwd: subject and forwarded header, leaving recipients empty', () => {
    const draft = createForwardDraft(baseMail);
    expect(draft.to).toBe('');
    expect(draft.subject).toBe('Fwd: 项目进度同步');
    expect(draft.body).toContain('----- 转发的邮件 -----');
    expect(draft.body).toContain('请在本周五前提交报告');
    expect(draft.inReplyTo).toBeUndefined();
  });
});

describe('buildDraftMail / buildSentMail', () => {
  const draft = { ...createEmptyDraft(), to: 'a@x.com', subject: '会议纪要', body: '<p>请尽快<b>确认</b></p>' };

  it('should build a draft mail in DRAFTS folder with Draft flag', () => {
    const mail = buildDraftMail(draft, 'me@example.com', '2026-08-04T09:00:00.000Z');
    expect(mail.folder).toBe(FOLDER_DRAFTS);
    expect(mail.flags).toContain('\\Draft');
    expect(mail.from.email).toBe('me@example.com');
    expect(mail.to.map((addr) => addr.email)).toEqual(['a@x.com']);
    // HTML 正文保留，同时提取纯文本供摘要/降级展示
    expect(mail.bodyHtml).toBe('<p>请尽快<b>确认</b></p>');
    expect(mail.bodyText).toBe('请尽快确认');
  });

  it('should build a sent mail in SENT folder without Draft flag', () => {
    const mail = buildSentMail({
      draft,
      selfEmail: 'me@example.com',
      messageId: '<sent@example.com>',
      nowIso: '2026-08-04T09:00:00.000Z',
    });
    expect(mail.folder).toBe(FOLDER_SENT);
    expect(mail.flags).not.toContain('\\Draft');
    expect(mail.flags).toContain('\\Seen');
    expect(mail.messageId).toBe('<sent@example.com>');
    expect(mail.bodyHtml).toBe('<p>请尽快<b>确认</b></p>');
    expect(mail.bodyText).toBe('请尽快确认');
  });
});
