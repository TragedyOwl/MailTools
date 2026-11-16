import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleAISummarizeStream } from '../../server/aiCore';

/**
 * POST /api/ai/summarize-stream：AI 摘要流式代理（SSE）。
 * 以 text/event-stream 分块下发，实时转发模型增量输出；失败时下发 error 事件。
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // 禁用代理 / 网关缓冲，确保 SSE 事件实时下发而非攒批
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    await handleAISummarizeStream(req.body, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.write(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`);
    res.end();
  }
}
