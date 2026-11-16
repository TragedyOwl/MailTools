import { addDays, nextDay, setHours, setMinutes, setSeconds, type Day } from 'date-fns';

/**
 * 从邮件文本中提取日期时间信息（中文语境）。
 * 支持：2026-08-01 / 8月1日 / 明天 / 后天 / 下周三 + 14:00 / 下午2点 等组合。
 */

const WEEKDAY_MAP: Record<string, Day> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 0,
  天: 0,
};

interface TimeSpec {
  hour: number;
  minute: number;
}

/** 提取时间片段：14:00 / 下午2点 / 上午9点半 / 晚上7点 */
const extractTime = (text: string): TimeSpec | null => {
  const hm = text.match(/([01]?\d|2[0-3])[:：]([0-5]\d)/);
  if (hm) return { hour: Number(hm[1]), minute: Number(hm[2]) };

  const cn = text.match(/(上午|早上|中午|下午|晚上)?\s*([一二三四五六七八九十\d]{1,2})点(半|([一二三四五六七八九十\d]{1,2})分)?/);
  if (cn) {
    const cnDigit = (s: string): number => {
      const map: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
      if (/^\d+$/.test(s)) return Number(s);
      if (s === '十') return 10;
      if (s.length === 2 && s.startsWith('十')) return 10 + (map[s[1]] ?? 0);
      if (s.length === 2 && s.endsWith('十')) return (map[s[0]] ?? 1) * 10;
      return map[s] ?? 0;
    };
    let hour = cnDigit(cn[2]);
    const meridiem = cn[1];
    if ((meridiem === '下午' || meridiem === '晚上') && hour < 12) hour += 12;
    if (meridiem === '中午' && hour < 12) hour = 12;
    let minute = 0;
    if (cn[3] === '半') minute = 30;
    else if (cn[4]) minute = cnDigit(cn[4]);
    if (hour >= 0 && hour <= 23) return { hour, minute };
  }
  return null;
};

const applyTime = (date: Date, time: TimeSpec | null, defaultHour: number): Date => {
  const withHour = setHours(date, time ? time.hour : defaultHour);
  const withMinute = setMinutes(withHour, time ? time.minute : 0);
  return setSeconds(withMinute, 0);
};

/**
 * 提取文本中的日期时间候选（最多 max 个），返回 ISO 字符串数组。
 * @param text 邮件主题+正文
 * @param base 相对日期基准（通常为当前时间）
 */
export const extractDates = (text: string, base: Date = new Date(), max = 3): string[] => {
  const results: Date[] = [];
  const time = extractTime(text);
  const defaultHour = time ? time.hour : 9;

  // 1. 完整日期：2026-08-01 / 2026/8/1 / 2026年8月1日
  const fullDate = text.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})日?/);
  if (fullDate) {
    const d = new Date(Number(fullDate[1]), Number(fullDate[2]) - 1, Number(fullDate[3]));
    if (!Number.isNaN(d.getTime())) results.push(applyTime(d, time, defaultHour));
  }

  // 2. 月日（无年份，取今年，已过则取明年）：8月1日
  if (results.length === 0) {
    const md = text.match(/(\d{1,2})月(\d{1,2})[日号]/);
    if (md) {
      let d = new Date(base.getFullYear(), Number(md[1]) - 1, Number(md[2]));
      if (d.getTime() < base.getTime() - 24 * 3600 * 1000) {
        d = new Date(base.getFullYear() + 1, Number(md[1]) - 1, Number(md[2]));
      }
      results.push(applyTime(d, time, defaultHour));
    }
  }

  // 3. 相对日：今天 / 明天 / 后天 / 大后天
  if (results.length === 0) {
    const rel = text.match(/(大后天|后天|明天|今日|今天)/);
    if (rel) {
      const offset = rel[1] === '大后天' ? 3 : rel[1] === '后天' ? 2 : rel[1] === '明天' ? 1 : 0;
      results.push(applyTime(addDays(base, offset), time, defaultHour));
    }
  }

  // 4. 下周X / 周X / 星期X
  if (results.length === 0) {
    const week = text.match(/(下下周|下周|这周|本周|周|星期)([一二三四五六日天])/);
    if (week) {
      const target = WEEKDAY_MAP[week[2]];
      if (target !== undefined) {
        let d = nextDay(base, target);
        if (week[1] === '下下周') d = addDays(d, 7);
        if (week[1] === '这周' || week[1] === '本周') {
          const candidate = addDays(d, -7);
          d = candidate.getTime() > base.getTime() ? candidate : d;
        }
        results.push(applyTime(d, time, defaultHour));
      }
    }
  }

  return results.slice(0, max).map((d) => d.toISOString());
};

/** 提取截止日期线索：截止/DDL/之前完成 等附近的日期 */
export const extractDeadline = (text: string, base: Date = new Date()): string | null => {
  const deadlinePattern = /(截止|截止日期|ddl|deadline|之前完成|前完成|前提交|前反馈)[：:，,]?\s*([^。；;\n]{0,40})/i;
  const match = text.match(deadlinePattern);
  if (!match) return null;
  const dates = extractDates(match[2], base, 1);
  return dates[0] ?? null;
};

/**
 * 为缺失具体时刻的截止时间补全时分：
 * AI 可能只返回日期（如 "2026-08-05"）或把时刻归零，而邮件正文中明明写了
 * "8月5日10:40"。此处在上下文（邮件主题/正文/摘要）中定位同一日期的出现位置，
 * 从附近窗口提取时刻并回填；找不到时刻时保持原值。
 * @param deadline AI 返回的截止时间（可解析或中文描述均可）
 * @param contextText 邮件主题+正文+摘要拼接文本
 */
export const enrichDeadlineTime = (deadline: string, contextText: string): string => {
  if (!deadline) return deadline;

  // 纯日期（如 "2026-08-05"）：new Date 会按 UTC 午夜解析导致本地时间偏移，
  // 此处手动构造本地午夜，并标记为需要补全时刻
  const dateOnly = deadline.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  let date: Date;
  if (dateOnly) {
    date = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  } else {
    date = new Date(deadline);
    if (Number.isNaN(date.getTime())) {
      // 中文等非标准格式：先走文本提取（含时刻则直接返回）
      const extracted = extractDates(deadline, undefined, 1)[0];
      if (!extracted) return deadline;
      date = new Date(extracted);
    }
  }
  if (Number.isNaN(date.getTime())) return deadline;

  // 已有非零时刻，无需补全
  if (date.getHours() !== 0 || date.getMinutes() !== 0) return date.toISOString();

  // 在上下文中定位该日期的所有出现位置，取附近窗口内的时刻
  const patterns = [
    `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`,
    `${date.getMonth() + 1}月${date.getDate()}日`,
    `${date.getMonth() + 1}月${date.getDate()}号`,
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`,
  ];

  for (const pattern of patterns) {
    let from = 0;
    for (;;) {
      const idx = contextText.indexOf(pattern, from);
      if (idx === -1) break;
      const windowText = contextText.slice(Math.max(0, idx - 30), idx + pattern.length + 40);
      const time = extractTime(windowText);
      if (time) {
        return applyTime(date, time, 0).toISOString();
      }
      from = idx + pattern.length;
    }
  }

  return date.toISOString();
};
