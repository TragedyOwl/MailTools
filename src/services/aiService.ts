import type {
  AISummarizeRequest,
  AISummarizeResponse,
  AISummarizeStreamEvent,
  AISummaryResult,
  AITestResponse,
  Mail,
  MailSummary,
} from '@/types';
import { AI_MAX_BODY_CHARS, AI_MAX_RETRIES, AI_TIMEOUT_MS } from '@/utils/constants';
import { localClassify, localPriority, previewText } from '@/utils/mailParser';
import { extractDeadline } from '@/utils/dateExtractor';

export interface AIClientConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const postSummarize = async (payload: AISummarizeRequest): Promise<{ result: AISummaryResult; raw: string }> => {
  const response = await fetch('/api/ai/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });

  const data = (await response.json().catch(() => ({}))) as AISummarizeResponse;
  if (!response.ok || !data.result) {
    throw new Error(data.error ?? `HTTP ${response.status}`);
  }
  return { result: data.result, raw: data.raw ?? '' };
};

/** 测试 AI 密钥与端点连通性（不传 ai 则验证服务端环境变量配置） */
export const testAIConnection = async (ai?: AIClientConfig): Promise<AITestResponse> => {
  const response = await fetch('/api/ai/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ai }),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });
  const data = (await response.json().catch(() => ({}))) as AITestResponse;
  if (!response.ok && data.ok !== false) {
    return { ok: false, error: data.error ?? `HTTP ${response.status}` };
  }
  return data;
};

/** 本地降级摘要：AI 不可用 / 隐私模式下使用 */
export const buildLocalSummary = (mail: Mail): MailSummary => {
  const text = `${mail.subject}\n${mail.bodyText}`;
  const deadline = extractDeadline(text);
  const actionItems = deadline
    ? [{ content: `处理：${mail.subject}`, deadline, confidence: 0.5 }]
    : [];

  return {
    coreContent: `${previewText(mail.bodyText, 200)}（摘要生成失败，显示原文预览）`,
    keyPoints: [],
    actionItems,
    sentiment: 'neutral',
    source: 'local',
    generatedAt: new Date().toISOString(),
  };
};

/**
 * 生成单封邮件摘要：重试 + 超时控制 + 错误降级
 * 重试 3 次（指数退避），全部失败返回本地降级摘要。
 */
export const summarizeMail = async (mail: Mail, ai?: AIClientConfig): Promise<MailSummary> => {
  const payload: AISummarizeRequest = {
    mode: 'mail',
    subject: mail.subject,
    from: `${mail.from.name} <${mail.from.email}>`,
    body: mail.bodyText.slice(0, AI_MAX_BODY_CHARS),
    ai,
  };

  for (let attempt = 0; attempt < AI_MAX_RETRIES; attempt++) {
    try {
      const { result } = await postSummarize(payload);
      return {
        coreContent: result.coreContent,
        keyPoints: result.keyPoints,
        actionItems: result.actionItems,
        sentiment: result.sentiment,
        source: 'ai',
        generatedAt: new Date().toISOString(),
      };
    } catch {
      if (attempt < AI_MAX_RETRIES - 1) {
        await delay(1000 * (attempt + 1));
      }
    }
  }

  return buildLocalSummary(mail);
};

/** 请求 AI 返回的分类与优先级（与摘要同批请求失败时回退本地规则）；error 返回最后一次失败原因（成功为 undefined）；raw 为模型原始输出 */
export const summarizeWithMeta = async (
  mail: Mail,
  ai?: AIClientConfig
): Promise<{ summary: MailSummary; category: Mail['category']; priority: Mail['priority']; error?: string; raw?: string }> => {
  const payload: AISummarizeRequest = {
    mode: 'mail',
    subject: mail.subject,
    from: `${mail.from.name} <${mail.from.email}>`,
    body: mail.bodyText.slice(0, AI_MAX_BODY_CHARS),
    ai,
  };

  let lastError = '';
  for (let attempt = 0; attempt < AI_MAX_RETRIES; attempt++) {
    try {
      const { result, raw } = await postSummarize(payload);
      return {
        summary: {
          coreContent: result.coreContent,
          keyPoints: result.keyPoints,
          actionItems: result.actionItems,
          sentiment: result.sentiment,
          source: 'ai',
          generatedAt: new Date().toISOString(),
        },
        category: result.category,
        priority: result.priority,
        error: undefined,
        raw,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < AI_MAX_RETRIES - 1) {
        await delay(1000 * (attempt + 1));
      }
    }
  }

  return {
    summary: buildLocalSummary(mail),
    category: localClassify(mail.subject, mail.bodyText),
    priority: localPriority(mail.subject, mail.bodyText),
    error: lastError || 'AI 调用失败',
  };
};

/** 流式摘要返回结果（streamed 标识是否走了网络流式，降级时 false） */
export interface StreamSummaryResult {
  summary: MailSummary;
  category: Mail['category'];
  priority: Mail['priority'];
  error?: string;
  raw?: string;
  streamed: boolean;
}

/**
 * 流式生成单封邮件摘要（网络级实时）：
 * 请求 /api/ai/summarize-stream（SSE），通过 ReadableStream 逐块读取，
 * 每收到 delta 即调用 onDelta 实时推送模型增量输出；流结束后返回结构化摘要。
 * 流式失败（网关不支持 / 网络异常）时自动降级为非流式 summarizeWithMeta，保证摘要可用。
 */
export const summarizeMailStream = async (
  mail: Mail,
  ai: AIClientConfig | undefined,
  onDelta: (text: string) => void
): Promise<StreamSummaryResult> => {
  const payload: AISummarizeRequest = {
    mode: 'mail',
    subject: mail.subject,
    from: `${mail.from.name} <${mail.from.email}>`,
    body: mail.bodyText.slice(0, AI_MAX_BODY_CHARS),
    ai,
  };

  try {
    const response = await fetch('/api/ai/summarize-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result: AISummaryResult | undefined;
    let raw = '';
    let streamError = '';

    const handleEvent = (chunk: string): void => {
      const line = chunk.trim();
      if (!line.startsWith('data:')) return;
      const data = line.slice(5).trim();
      if (!data) return;
      let evt: AISummarizeStreamEvent;
      try {
        evt = JSON.parse(data) as AISummarizeStreamEvent;
      } catch {
        return;
      }
      if (evt.type === 'delta') onDelta(evt.text);
      else if (evt.type === 'done') {
        result = evt.result;
        raw = evt.raw;
      } else if (evt.type === 'error') streamError = evt.error;
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) handleEvent(part);
    }
    if (buffer.trim()) handleEvent(buffer);

    if (streamError) throw new Error(streamError);
    if (!result) throw new Error('流式响应未返回结果');

    return {
      summary: {
        coreContent: result.coreContent,
        keyPoints: result.keyPoints,
        actionItems: result.actionItems,
        sentiment: result.sentiment,
        source: 'ai',
        generatedAt: new Date().toISOString(),
      },
      category: result.category,
      priority: result.priority,
      raw,
      streamed: true,
    };
  } catch {
    // 流式失败降级为非流式（onDelta 未触发，由调用方用 raw 补设输出）
    const fallback = await summarizeWithMeta(mail, ai);
    return { ...fallback, streamed: false };
  }
};

/** 生成任务合并摘要（失败返回 null，由调用方降级） */
export const summarizeTask = async (
  title: string,
  combinedBodies: string,
  ai?: AIClientConfig
): Promise<string | null> => {
  const payload: AISummarizeRequest = {
    mode: 'task',
    subject: title,
    body: combinedBodies.slice(0, AI_MAX_BODY_CHARS),
    ai,
  };

  try {
    const { result } = await postSummarize(payload);
    const points = result.keyPoints.length > 0 ? `\n关键信息：${result.keyPoints.join('；')}` : '';
    return `${result.coreContent}${points}`;
  } catch {
    return null;
  }
};
