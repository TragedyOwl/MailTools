import type {
  AISummarizeRequest,
  AISummarizeResponse,
  AISummarizeStreamEvent,
  AISummaryResult,
  AITestResponse,
  MailCategory,
  Priority,
} from '../src/types';

// 推理模型（如 MiniMax-M2.5）生成含思考过程的长 JSON 摘要耗时较长，超时需预留充足；
// 服务端超时（100s）略短于前端（120s），以便超时后能向前端返回带信息的错误而非前端直接 abort
const REQUEST_TIMEOUT_MS = 100000;
const MAX_BODY_CHARS = 4000;

const CATEGORIES: MailCategory[] = ['notification', 'task', 'meeting', 'approval', 'other'];
const PRIORITIES: Priority[] = ['high', 'medium', 'low'];
const SENTIMENTS = ['positive', 'neutral', 'negative'] as const;

interface ResolvedAIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Base URL 以 # 结尾（cherrystudio 模式）：禁用自动追加 /chat/completions，地址作为完整请求端点直接调用 */
  rawEndpoint: boolean;
}

const resolveConfig = (request: AISummarizeRequest): ResolvedAIConfig => {
  const rawBaseUrl = request.ai?.baseUrl || process.env.AI_API_URL || '';
  const apiKey = request.ai?.apiKey || process.env.AI_API_KEY || '';
  const model = request.ai?.model || process.env.AI_MODEL || '';
  if (!rawBaseUrl || !apiKey || !model) {
    throw new Error('AI 服务未配置：请在设置页填写 API 地址、Key 与模型，或配置服务端环境变量');
  }
  // 末尾 # 表示禁用自动追加 API 路径：去掉 # 与尾斜杠后作为完整端点
  const rawEndpoint = rawBaseUrl.trimEnd().endsWith('#');
  const baseUrl = rawBaseUrl.replace(/#+$/, '').replace(/\/+$/, '');
  return { baseUrl, apiKey, model, rawEndpoint };
};

const MAIL_PROMPT = `请对以下邮件内容进行标准化摘要。要求：
1. 核心内容用1-3句话概括
2. 提取所有关键信息点（时间/地点/人物/要求）
3. 识别是否有需要执行的事项（Action Items），包含截止时间（"YYYY-MM-DD HH:mm" 格式；若邮件中有具体时刻必须带上，不要丢弃；仅有日期时时刻写 00:00；无截止时间则 null）
4. 判断紧急程度（high/medium/low）和类别（notification通知/task任务/meeting会议/approval审批/other其他）
5. 判断情感倾向（positive/neutral/negative）
6. 仅基于提供邮件内容分析，不要编造信息
7. 严格输出 JSON，不要输出任何其他内容

邮件主题：{subject}
发件人：{from}
内容：{body}

输出格式：
{
  "coreContent": "string",
  "keyPoints": ["string"],
  "actionItems": [{"content": "string", "deadline": "YYYY-MM-DD HH:mm|null", "assignee": "string|null", "confidence": 0.0}],
  "priority": "high|medium|low",
  "category": "notification|task|meeting|approval|other",
  "sentiment": "positive|neutral|negative"
}`;

const TASK_PROMPT = `以下是同一任务下的多封邮件内容（按时间排序）。请生成一份合并摘要，帮助读者快速掌握整个任务的来龙去脉。要求：
1. 核心内容用2-4句话概括任务的整体进展与当前状态
2. 提取任务的关键信息点（里程碑/结论/阻塞点）
3. 汇总所有未完成的执行事项
4. 仅基于提供邮件内容分析，不要编造信息
5. 严格输出 JSON，不要输出任何其他内容

任务主题：{subject}
邮件内容：
{body}

输出格式：
{
  "coreContent": "string",
  "keyPoints": ["string"],
  "actionItems": [{"content": "string", "deadline": "YYYY-MM-DD HH:mm|null", "assignee": "string|null", "confidence": 0.0}],
  "priority": "high|medium|low",
  "category": "notification|task|meeting|approval|other",
  "sentiment": "positive|neutral|negative"
}`;

const SYSTEM_PROMPT = '你是一个企业邮件智能助手，擅长从邮件中提取结构化信息。始终严格输出 JSON。';

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

const callChatCompletion = async (config: ResolvedAIConfig, prompt: string, maxTokens = 1600): Promise<string> => {
  // rawEndpoint（Base URL 以 # 结尾）：地址即完整端点；否则按 OpenAI 兼容约定追加 /chat/completions
  const url = config.rawEndpoint ? config.baseUrl : `${config.baseUrl}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: maxTokens,
      // 部分企业网关（如本项目使用的代理）强制要求显式 stream 字段，缺失会返回 500 {"success":false}
      stream: false,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`AI 接口错误 HTTP ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(data.error?.message ?? 'AI 返回内容为空');
  }
  return content;
};

const normalizeString = (value: unknown): string => (typeof value === 'string' ? value : '');

const normalizeResult = (raw: unknown): AISummaryResult => {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;

  const keyPoints = Array.isArray(obj.keyPoints)
    ? obj.keyPoints.filter((p): p is string => typeof p === 'string').slice(0, 10)
    : [];

  const actionItems = Array.isArray(obj.actionItems)
    ? obj.actionItems
        .map((item) => {
          const record = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
          return {
            content: normalizeString(record.content),
            deadline: normalizeString(record.deadline) || undefined,
            assignee: normalizeString(record.assignee) || undefined,
            confidence:
              typeof record.confidence === 'number' && record.confidence >= 0 && record.confidence <= 1
                ? record.confidence
                : 0.7,
          };
        })
        .filter((item) => item.content.length > 0)
        .slice(0, 10)
    : [];

  const priority = PRIORITIES.includes(obj.priority as Priority) ? (obj.priority as Priority) : 'medium';
  const category = CATEGORIES.includes(obj.category as MailCategory) ? (obj.category as MailCategory) : 'other';
  const sentiment = SENTIMENTS.includes(obj.sentiment as (typeof SENTIMENTS)[number])
    ? (obj.sentiment as AISummaryResult['sentiment'])
    : 'neutral';

  return {
    coreContent: normalizeString(obj.coreContent) || '（摘要内容为空）',
    keyPoints,
    actionItems,
    priority,
    category,
    sentiment,
  };
};

/** POST /api/ai/summarize：AI 摘要代理（mail=单封摘要 task=任务合并摘要） */
export const handleAISummarize = async (payload: unknown): Promise<AISummarizeResponse> => {
  const request = (typeof payload === 'object' && payload !== null ? payload : {}) as AISummarizeRequest;
  const config = resolveConfig(request);

  const subject = typeof request.subject === 'string' ? request.subject : '(无主题)';
  const from = typeof request.from === 'string' ? request.from : '';
  const body = typeof request.body === 'string' ? request.body.slice(0, MAX_BODY_CHARS) : '';

  const template = request.mode === 'task' ? TASK_PROMPT : MAIL_PROMPT;
  const prompt = template.replace('{subject}', subject).replace('{from}', from).replace('{body}', body);

  const content = await callChatCompletion(config, prompt);

  // 推理模型常输出 <think> 思考过程并用 ```json 代码块包裹结果：先剥离代码块再贪婪匹配 JSON
  const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonMatch = (fence ? fence[1] : content).match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI 返回内容不是合法 JSON');
  }

  const parsed: unknown = JSON.parse(jsonMatch[0]);
  // 同时返回模型原始输出（含推理模型思考过程），供前端详情面板打字机逐字展示
  return { result: normalizeResult(parsed), raw: content };
};

/** 从文本中提取 JSON：先剥离 ```json 代码块再贪婪匹配，失败返回 null */
const extractJson = (text: string): string | null => {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const matched = (fence ? fence[1] : text).match(/\{[\s\S]*\}/);
  return matched ? matched[0] : null;
};

/**
 * POST /api/ai/summarize-stream：AI 摘要流式代理（SSE）。
 * 以 stream:true 调用网关，实时解析 OpenAI 兼容 SSE（delta.content 与推理模型 delta.reasoning_content），
 * 通过 sink 逐块向前端转发增量文本；流结束后从正式回复提取 JSON 并下发结构化结果。
 */
export const handleAISummarizeStream = async (
  payload: unknown,
  sink: (event: AISummarizeStreamEvent) => void
): Promise<void> => {
  const request = (typeof payload === 'object' && payload !== null ? payload : {}) as AISummarizeRequest;
  const config = resolveConfig(request);

  const subject = typeof request.subject === 'string' ? request.subject : '(无主题)';
  const from = typeof request.from === 'string' ? request.from : '';
  const body = typeof request.body === 'string' ? request.body.slice(0, MAX_BODY_CHARS) : '';
  const template = request.mode === 'task' ? TASK_PROMPT : MAIL_PROMPT;
  const prompt = template.replace('{subject}', subject).replace('{from}', from).replace('{body}', body);

  const url = config.rawEndpoint ? config.baseUrl : `${config.baseUrl}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1600,
      stream: true,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    throw new Error(`AI 接口错误 HTTP ${response.status}: ${text.slice(0, 200)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let reasoning = '';
  let content = '';

  const handleLine = (line: string): void => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const data = trimmed.slice(5).trim();
    if (!data || data === '[DONE]') return;
    let json: { choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }> };
    try {
      json = JSON.parse(data) as typeof json;
    } catch {
      return;
    }
    const delta = json.choices?.[0]?.delta;
    if (!delta) return;
    // 推理模型：reasoning_content 为思考过程、content 为正式回复，两者均实时转发展示
    if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
      reasoning += delta.reasoning_content;
      sink({ type: 'delta', text: delta.reasoning_content });
    }
    if (typeof delta.content === 'string' && delta.content) {
      content += delta.content;
      sink({ type: 'delta', text: delta.content });
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) handleLine(line);
  }
  if (buffer.trim()) handleLine(buffer);

  // JSON 提取优先从正式回复 content，回退到含思考的完整文本
  const jsonStr = extractJson(content) ?? extractJson(reasoning + content);
  if (!jsonStr) throw new Error('AI 返回内容不是合法 JSON');

  const parsed: unknown = JSON.parse(jsonStr);
  sink({ type: 'done', result: normalizeResult(parsed), raw: reasoning + content });
};

/** POST /api/ai/test：验证 AI 密钥与端点是否可用（发送一次极简请求） */
export const handleAITest = async (payload: unknown): Promise<AITestResponse> => {
  const request = (typeof payload === 'object' && payload !== null ? payload : {}) as AISummarizeRequest;
  const config = resolveConfig(request);
  const content = await callChatCompletion(config, '这是一次连接测试，请仅回复 ok。', 10);
  const preview = content.trim().slice(0, 50);
  return {
    ok: true,
    model: config.model,
    message: `连接成功，模型已响应${preview ? `：${preview}` : ''}`,
  };
};
