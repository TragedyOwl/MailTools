import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { handleAISummarize, handleAISummarizeStream, handleAITest } from '../server/aiCore';
import { handleFetchAttachment, handleMailSync, handleMailTest } from '../server/imapCore';
import { handleMailSend, handleSmtpTest } from '../server/smtpCore';
import type { MailTestResponse } from '../src/types';

const MAX_BODY_BYTES = 64 * 1024 * 1024;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** 读取并解析 JSON 请求体；空请求体按 {} 处理，与 Vercel 行为保持一致 */
const readJsonBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer);
    total += buffer.byteLength;
    if (total > MAX_BODY_BYTES) {
      throw new HttpError(413, '请求体过大');
    }
    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new HttpError(400, '请求体不是合法 JSON');
  }
};

const sendJson = (res: ServerResponse, status: number, payload: unknown): void => {
  if (res.headersSent) return;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(payload));
};

const sendSse = (res: ServerResponse): void => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'X-Content-Type-Options': 'nosniff',
  });
  res.flushHeaders();
};

/** 处理 /api/*：复用 server/ 中的业务实现，替代 Vercel Serverless 路由 */
const handleApi = async (req: IncomingMessage, res: ServerResponse, route: string): Promise<void> => {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  // SSE 需要在读取请求体前先建立事件流，异常也通过 error 事件返回
  if (route === '/api/ai/summarize-stream') {
    sendSse(res);
    try {
      const payload = await readJsonBody(req);
      await handleAISummarizeStream(payload, (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      });
      res.end();
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage(err) })}\n\n`);
      res.end();
    }
    return;
  }

  try {
    const payload = await readJsonBody(req);

    switch (route) {
      case '/api/ai/test':
        try {
          sendJson(res, 200, await handleAITest(payload));
        } catch (err) {
          sendJson(res, 200, { ok: false, error: errorMessage(err) });
        }
        return;
      case '/api/ai/summarize':
        sendJson(res, 200, await handleAISummarize(payload));
        return;
      case '/api/mail/test': {
        const [imap, smtp] = await Promise.all([handleMailTest(payload), handleSmtpTest(payload)]);
        const result: MailTestResponse = smtp ? { ...imap, smtp } : imap;
        sendJson(res, 200, result);
        return;
      }
      case '/api/mail/sync':
        sendJson(res, 200, await handleMailSync(payload));
        return;
      case '/api/mail/send':
        sendJson(res, 200, await handleMailSend(payload));
        return;
      case '/api/mail/attachment':
        sendJson(res, 200, await handleFetchAttachment(payload));
        return;
      default:
        sendJson(res, 404, { error: 'Not Found' });
    }
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    sendJson(res, status, { error: errorMessage(err) });
  }
};

/** 将 URL 路径安全地映射到 dist 目录，阻止 ../ 越界访问 */
const resolveStaticPath = (distDir: string, requestPath: string): string => {
  let decoded: string;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    throw new HttpError(400, '非法请求路径');
  }

  const candidate = path.resolve(distDir, decoded.replace(/^\/+/, ''));
  if (candidate !== distDir && !candidate.startsWith(`${distDir}${path.sep}`)) {
    throw new HttpError(403, 'Forbidden');
  }
  return candidate;
};

const serveStatic = async (
  req: IncomingMessage,
  res: ServerResponse,
  distDir: string,
  requestPath: string
): Promise<void> => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const candidate = resolveStaticPath(distDir, requestPath);
  const indexPath = path.join(distDir, 'index.html');
  let filePath = candidate === distDir ? indexPath : candidate;

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      await stat(filePath);
    }
  } catch {
    // 非静态资源路径按 SPA 路由回退到 index.html；缺失的带扩展名资源直接 404
    const extension = path.extname(candidate);
    if (extension && extension !== '.html') {
      sendJson(res, 404, { error: 'Not Found' });
      return;
    }
    filePath = indexPath;
  }

  let size: number;
  try {
    const info = await stat(filePath);
    size = info.size;
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('未找到前端构建产物，请先运行 npm run build:web。');
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[extension] ?? 'application/octet-stream',
    'Content-Length': size,
    'Cache-Control': requestPath.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
};

const handleRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
  distDir: string
): Promise<void> => {
  const pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;

  if (pathname.startsWith('/api/')) {
    await handleApi(req, res, pathname);
    return;
  }

  await serveStatic(req, res, distDir, pathname);
};

export interface LocalServer {
  url: string;
  close: () => Promise<void>;
}

/** 启动仅绑定回环地址的本地服务，随机端口避免冲突 */
export const startLocalServer = async (distDir: string): Promise<LocalServer> => {
  const root = path.resolve(distDir);

  const server = createServer((req, res) => {
    void handleRequest(req, res, root).catch((err: unknown) => {
      if (!res.headersSent) {
        const status = err instanceof HttpError ? err.status : 500;
        sendJson(res, status, { error: errorMessage(err) });
      } else {
        res.end();
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (err: Error): void => {
      server.off('listening', onListening);
      reject(err);
    };
    const onListening = (): void => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(0, '127.0.0.1');
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('本地服务启动失败：无法获取监听端口');
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      }),
  };
};
