import { describe, expect, it } from 'vitest';
import { enrichDeadlineTime, extractDates, extractDeadline } from './dateExtractor';

/** 固定基准：2026-07-29（周三）10:00 本地时间 */
const BASE = new Date(2026, 6, 29, 10, 0, 0);

const iso = (year: number, month: number, day: number, hour: number, minute = 0): string =>
  new Date(year, month - 1, day, hour, minute, 0).toISOString();

describe('extractDates', () => {
  it('完整日期 + 24 小时制时间', () => {
    expect(extractDates('会议定于2026-08-01 14:00召开', BASE)).toEqual([iso(2026, 8, 1, 14)]);
  });

  it('完整日期（中文格式）无时间默认 9 点', () => {
    expect(extractDates('2026年8月1日 项目评审', BASE)).toEqual([iso(2026, 8, 1, 9)]);
  });

  it('月日格式 + 中文时间（下午转 24 小时制）', () => {
    expect(extractDates('8月5日下午2点开会', BASE)).toEqual([iso(2026, 8, 5, 14)]);
  });

  it('月日已过则取明年', () => {
    expect(extractDates('1月5日年度总结会', BASE)).toEqual([iso(2027, 1, 5, 9)]);
  });

  it('明天 + 上午时间', () => {
    expect(extractDates('明天上午10点代码评审', BASE)).toEqual([iso(2026, 7, 30, 10)]);
  });

  it('后天无时间默认 9 点', () => {
    expect(extractDates('后天提交周报', BASE)).toEqual([iso(2026, 7, 31, 9)]);
  });

  it('下周X（base 为周三，下周一为 8 月 3 日）', () => {
    expect(extractDates('下周一14:00例会', BASE)).toEqual([iso(2026, 8, 3, 14)]);
  });

  it('半点时间', () => {
    expect(extractDates('明天上午9点半站会', BASE)).toEqual([iso(2026, 7, 30, 9, 30)]);
  });

  it('无任何日期信息返回空数组', () => {
    expect(extractDates('随便聊聊最近的进展', BASE)).toEqual([]);
  });
});

describe('extractDeadline', () => {
  it('截止：月日', () => {
    expect(extractDeadline('报销审批截止：8月5日，请尽快处理', BASE)).toBe(iso(2026, 8, 5, 9));
  });

  it('截止日期：完整日期 + 时间', () => {
    expect(extractDeadline('截止日期：2026-08-10 18:00', BASE)).toBe(iso(2026, 8, 10, 18));
  });

  it('无截止关键词返回 null', () => {
    expect(extractDeadline('8月5日有个会议', BASE)).toBeNull();
  });

  it('有关键词但无日期返回 null', () => {
    expect(extractDeadline('尽快完成，谢谢', BASE)).toBeNull();
  });
});

describe('enrichDeadlineTime', () => {
  it('纯日期 + 正文含时刻 → 补全时刻', () => {
    const result = enrichDeadlineTime('2026-08-05', '时间：2026年8月5日10:40，地点：1102会议室');
    expect(result).toBe(iso(2026, 8, 5, 10, 40));
  });

  it('时刻为 00:00 + 正文中文日期格式 → 补全时刻', () => {
    const result = enrichDeadlineTime('2026-08-05 00:00', '汇报调整为8月5日10:40开始');
    expect(result).toBe(iso(2026, 8, 5, 10, 40));
  });

  it('已有非零时刻时保持不变', () => {
    const result = enrichDeadlineTime('2026-08-05 14:30', '8月5日10:40开会');
    expect(result).toBe(new Date(2026, 7, 5, 14, 30, 0).toISOString());
  });

  it('上下文找不到时刻时保持本地午夜', () => {
    const result = enrichDeadlineTime('2026-08-05', '请尽快处理汇报材料');
    expect(result).toBe(iso(2026, 8, 5, 0));
  });

  it('中文格式 deadline 自带时刻直接解析', () => {
    const result = enrichDeadlineTime('2026年8月5日 10:40', '');
    expect(result).toBe(iso(2026, 8, 5, 10, 40));
  });

  it('不可解析时原样返回', () => {
    expect(enrichDeadlineTime('尽快', '')).toBe('尽快');
  });
});
