import { describe, expect, it } from 'vitest';
import type { RawMail } from '@/types';
import { htmlToText, localClassify, localPriority, previewText, rawToMail, truncate } from './mailParser';

describe('htmlToText', () => {
  it('去除标签并保留段落换行', () => {
    expect(htmlToText('<p>你好</p><p>世界</p>')).toBe('你好\n世界');
  });

  it('br 标签转换为换行', () => {
    expect(htmlToText('第一行<br>第二行<br/>第三行')).toBe('第一行\n第二行\n第三行');
  });

  it('移除 style 与 script 块', () => {
    expect(htmlToText('<style>body{color:red}</style><p>正文</p><script>alert(1)</script>')).toBe('正文');
  });

  it('解码 HTML 实体', () => {
    expect(htmlToText('A&nbsp;B&amp;C&lt;D&gt;')).toBe('A B&C<D>');
  });

  it('压缩多余空行', () => {
    expect(htmlToText('<p>一</p><p></p><p></p><p>二</p>')).toBe('一\n\n二');
  });
});

describe('truncate / previewText', () => {
  it('超长截断并追加省略号', () => {
    expect(truncate('一二三四五六', 3)).toBe('一二三…');
  });

  it('未超长保持原样', () => {
    expect(truncate('短文本', 10)).toBe('短文本');
  });

  it('previewText 压缩空白后截断', () => {
    expect(previewText('  多  段\n\n文本  ', 80)).toBe('多 段 文本');
  });
});

describe('localClassify', () => {
  it('会议类', () => {
    expect(localClassify('周五例会通知', '')).toBe('meeting');
    expect(localClassify('项目评审会议邀请', '')).toBe('meeting');
  });

  it('审批类', () => {
    expect(localClassify('8月报销审批单', '')).toBe('approval');
    expect(localClassify('变更窗口申请', '')).toBe('approval');
  });

  it('任务类', () => {
    expect(localClassify('本周工作安排', '')).toBe('task');
  });

  it('通知类', () => {
    expect(localClassify('系统维护公告', '')).toBe('notification');
  });

  it('其他', () => {
    expect(localClassify('周末聚餐', '')).toBe('other');
  });

  it('正文关键词也参与分类', () => {
    expect(localClassify('请各位知悉', '请于明天下午三点参加视频会议')).toBe('meeting');
  });
});

describe('localPriority', () => {
  it('紧急类为高优先级', () => {
    expect(localPriority('【紧急】请立即处理', '')).toBe('high');
    expect(localPriority('urgent: server down', '')).toBe('high');
  });

  it('本周/重要为中优先级', () => {
    expect(localPriority('本周工作计划', '')).toBe('medium');
  });

  it('默认为低优先级', () => {
    expect(localPriority('随便聊聊', '')).toBe('low');
  });
});

describe('rawToMail', () => {
  const baseRaw: RawMail = {
    uid: 101,
    messageId: '<msg-101@x.com>',
    subject: '测试主题',
    from: { name: '张三', email: 'zhangsan@x.com' },
    to: [{ name: '我', email: 'me@x.com' }],
    date: '2026-07-29T02:00:00.000Z',
    bodyText: '纯文本正文',
    attachments: [],
    flags: ['\\Seen'],
    folder: 'INBOX',
  };

  const nowIso = '2026-07-29T03:00:00.000Z';

  it('基本字段转换', () => {
    const mail = rawToMail(baseRaw, nowIso);
    expect(mail.uid).toBe(101);
    expect(mail.subject).toBe('测试主题');
    expect(mail.bodyText).toBe('纯文本正文');
    expect(mail.createdAt).toBe(nowIso);
    expect(mail.syncedAt).toBe(nowIso);
    expect(mail.id).toBeTruthy();
  });

  it('无纯文本时从 HTML 提取正文', () => {
    const mail = rawToMail({ ...baseRaw, bodyText: '', bodyHtml: '<p>HTML正文</p>' }, nowIso);
    expect(mail.bodyText).toBe('HTML正文');
    expect(mail.bodyHtml).toBe('<p>HTML正文</p>');
  });

  it('空主题回退为 (无主题)', () => {
    const mail = rawToMail({ ...baseRaw, subject: '' }, nowIso);
    expect(mail.subject).toBe('(无主题)');
  });

  it('发件人无名称时使用邮箱前缀', () => {
    const mail = rawToMail({ ...baseRaw, from: { name: '', email: 'lisi@x.com' } }, nowIso);
    expect(mail.from.name).toBe('lisi');
  });

  it('空 messageId 回退为 uid 标识', () => {
    const mail = rawToMail({ ...baseRaw, messageId: '' }, nowIso);
    expect(mail.messageId).toBe('uid-101');
  });

  it('分类与优先级来自本地规则', () => {
    const mail = rawToMail({ ...baseRaw, subject: '【紧急】周五例会通知' }, nowIso);
    expect(mail.category).toBe('meeting');
    expect(mail.priority).toBe('high');
  });
});
