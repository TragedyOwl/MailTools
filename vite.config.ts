import { fileURLToPath, URL } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv, type Plugin, type UserConfig } from 'vite';
import type { UserConfig as VitestUserConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import type { AISummarizeStreamEvent } from './src/types';

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => {
      data += chunk.toString('utf-8');
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

type ApiHandler = (payload: Record<string, unknown>) => Promise<unknown>;

type StreamSink = (event: AISummarizeStreamEvent) => void;
type StreamHandler = (payload: Record<string, unknown>, sink: StreamSink) => Promise<void>;

const sendJson = (res: ServerResponse, status: number, body: unknown): void => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

const mount = (
  server: { middlewares: { use: (path: string, fn: (req: IncomingMessage, res: ServerResponse) => void) => void } },
  path: string,
  handler: ApiHandler
): void => {
  server.middlewares.use(path, (req, res) => {
    void (async () => {
      try {
        const raw = await readBody(req);
        const payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        const result = await handler(payload);
        sendJson(res, 200, result);
      } catch (err) {
        sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
      }
    })();
  });
};

/** 挂载 SSE 流式端点：以 text/event-stream 分块下发，handler 通过 sink 逐条推送事件 */
const mountStream = (
  server: { middlewares: { use: (path: string, fn: (req: IncomingMessage, res: ServerResponse) => void) => void } },
  path: string,
  handler: StreamHandler
): void => {
  server.middlewares.use(path, (req, res) => {
    void (async () => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      try {
        const raw = await readBody(req);
        const payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        await handler(payload, (event) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        });
        res.end();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.write(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`);
        res.end();
      }
    })();
  });
};

/**
 * 本地开发 API 中间件：
 * 浏览器无法直连 IMAP，生产环境由 Vercel Functions (/api/*) 代理，
 * 开发环境由该 Vite 插件提供完全相同的接口。
 */
const devApiPlugin = (): Plugin => ({
  name: 'smart-mail-dev-api',
  configureServer(server) {
    mount(server, '/api/mail/test', async (payload) => {
      const { handleMailTest } = await import('./server/imapCore');
      const { handleSmtpTest } = await import('./server/smtpCore');
      // IMAP 收件 + SMTP 发件（可选）并行测试，与 api/mail/test.ts 行为一致
      const [imap, smtp] = await Promise.all([handleMailTest(payload), handleSmtpTest(payload)]);
      return smtp ? { ...imap, smtp } : imap;
    });
    mount(server, '/api/mail/sync', async (payload) => {
      const { handleMailSync } = await import('./server/imapCore');
      return handleMailSync(payload);
    });
    mount(server, '/api/mail/send', async (payload) => {
      const { handleMailSend } = await import('./server/smtpCore');
      return handleMailSend(payload);
    });
    mount(server, '/api/mail/attachment', async (payload) => {
      const { handleFetchAttachment } = await import('./server/imapCore');
      return handleFetchAttachment(payload);
    });
    mount(server, '/api/ai/summarize', async (payload) => {
      const { handleAISummarize } = await import('./server/aiCore');
      return handleAISummarize(payload);
    });
    mountStream(server, '/api/ai/summarize-stream', async (payload, sink) => {
      const { handleAISummarizeStream } = await import('./server/aiCore');
      await handleAISummarizeStream(payload, sink);
    });
    mount(server, '/api/ai/test', async (payload) => {
      const { handleAITest } = await import('./server/aiCore');
      try {
        return await handleAITest(payload);
      } catch (err) {
        // 与 api/ai/test.ts 一致：连接失败以 { ok:false, error } 返回，便于前端展示具体原因
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    });
  },
});

export default defineConfig(({ mode }): UserConfig & VitestUserConfig => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(env)) {
    if (!(key in process.env)) process.env[key] = value;
  }

  return {
    plugins: [react(), devApiPlugin()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            store: ['zustand', 'dexie'],
          },
        },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
