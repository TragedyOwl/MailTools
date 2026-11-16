import { describe, expect, it } from 'vitest';
import { cleanSubject, diceCoefficient, extractProjectCode, subjectSimilarity } from './stringSimilarity';

describe('cleanSubject', () => {
  it('去除 Re:/Fwd: 前缀', () => {
    expect(cleanSubject('Re: 项目进度汇报')).toBe('项目进度汇报');
    expect(cleanSubject('Fwd: 项目进度汇报')).toBe('项目进度汇报');
    expect(cleanSubject('Re: Re: 项目进度汇报')).toBe('项目进度汇报');
  });

  it('去除中文 回复：/转发： 前缀', () => {
    expect(cleanSubject('回复：项目进度汇报')).toBe('项目进度汇报');
    expect(cleanSubject('转发: 项目进度汇报')).toBe('项目进度汇报');
  });

  it('压缩空白并转小写', () => {
    expect(cleanSubject('Re:  PROJ-100   升级  申请 ')).toBe('proj-100 升级 申请');
  });
});

describe('diceCoefficient', () => {
  it('完全相同返回 1', () => {
    expect(diceCoefficient('项目进度', '项目进度')).toBe(1);
  });

  it('完全不同返回 0', () => {
    expect(diceCoefficient('abcdef', 'xyz')).toBe(0);
  });

  it('单字符字符串返回 0', () => {
    expect(diceCoefficient('a', 'b')).toBe(0);
  });

  it('部分相似返回值在 0-1 之间', () => {
    const score = diceCoefficient('项目进度汇报会议', '项目进度评审会议');
    expect(score).toBeGreaterThan(0.4);
    expect(score).toBeLessThan(1);
  });
});

describe('subjectSimilarity', () => {
  it('Re: 前缀不影响相似度', () => {
    expect(subjectSimilarity('Re: Q3项目进度汇报会议通知', 'Q3项目进度汇报会议通知')).toBe(1);
  });

  it('回复：前缀不影响相似度', () => {
    expect(subjectSimilarity('回复：报销审批单', '报销审批单')).toBe(1);
  });

  it('完全不同的主题相似度低', () => {
    expect(subjectSimilarity('系统维护通知', '部门团建活动报名')).toBeLessThan(0.8);
  });
});

describe('extractProjectCode', () => {
  it('提取方括号代号', () => {
    expect(extractProjectCode('[PROJ-2026] 核心系统升级')).toBe('PROJ-2026');
  });

  it('提取中文括号代号', () => {
    expect(extractProjectCode('【TASK-007】需求评审')).toBe('TASK-007');
  });

  it('提取井号代号', () => {
    expect(extractProjectCode('#ABC-123 缺陷修复')).toBe('ABC-123');
  });

  it('无括号纯文本代号也可提取并转大写', () => {
    expect(extractProjectCode('proj-456 升级窗口')).toBe('PROJ-456');
  });

  it('无代号返回 null', () => {
    expect(extractProjectCode('关于提交本周周报的通知')).toBeNull();
  });
});
