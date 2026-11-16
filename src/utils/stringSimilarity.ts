/**
 * 字符串相似度工具：
 * 使用 Dice Coefficient（二元组 bigram），兼顾性能与准确度。
 */

/** 清洗邮件主题：去除 Re:/Fwd:/回复：/转发： 前缀、压缩空白、转小写 */
export const cleanSubject = (subject: string): string =>
  subject
    .replace(/^(Re|Fwd|Fw|回复|转发|答复)[:：]\s*/i, '')
    .replace(/^(Re|Fwd|Fw|回复|转发|答复)[:：]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const bigrams = (input: string): Map<string, number> => {
  const map = new Map<string, number>();
  for (let i = 0; i < input.length - 1; i++) {
    const pair = input.slice(i, i + 2);
    map.set(pair, (map.get(pair) ?? 0) + 1);
  }
  return map;
};

/** Dice 系数：0（完全不同）~ 1（完全相同） */
export const diceCoefficient = (a: string, b: string): number => {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const aGrams = bigrams(a);
  const bGrams = bigrams(b);

  let intersection = 0;
  for (const [gram, count] of aGrams) {
    const other = bGrams.get(gram);
    if (other !== undefined) intersection += Math.min(count, other);
  }

  return (2 * intersection) / (a.length - 1 + (b.length - 1));
};

/** 计算两个邮件主题的相似度（先清洗前缀） */
export const subjectSimilarity = (s1: string, s2: string): number =>
  diceCoefficient(cleanSubject(s1), cleanSubject(s2));

/** 提取项目代号，如 [PROJECT-123] / PROJ-456 / #TASK-007 */
export const extractProjectCode = (text: string): string | null => {
  const match = text.match(/[[【#]?([A-Za-z][A-Za-z0-9]{1,9}-\d{1,6})[\]】]?/);
  return match ? match[1].toUpperCase() : null;
};
