import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startLocalServer, type LocalServer } from './localServer';

let server: LocalServer;
let distDir: string;

beforeAll(async () => {
  distDir = await mkdtemp(path.join(tmpdir(), 'mailtools-dist-'));
  await mkdir(path.join(distDir, 'assets'), { recursive: true });
  await writeFile(path.join(distDir, 'index.html'), '<!doctype html><title>MailTools Test</title>');
  await writeFile(path.join(distDir, 'assets', 'app.js'), 'console.log("ok");');
  server = await startLocalServer(distDir);
});

afterAll(async () => {
  await server.close();
  await rm(distDir, { recursive: true, force: true });
});

describe('desktop local server', () => {
  it('serves index.html and falls back to it for SPA routes', async () => {
    const root = await fetch(`${server.url}/`);
    expect(root.status).toBe(200);
    expect(await root.text()).toContain('MailTools Test');

    const route = await fetch(`${server.url}/tasks`);
    expect(route.status).toBe(200);
    expect(await route.text()).toContain('MailTools Test');
  });

  it('serves static assets with immutable cache headers', async () => {
    const response = await fetch(`${server.url}/assets/app.js`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/javascript');
    expect(response.headers.get('cache-control')).toContain('immutable');
  });

  it('returns 404 for missing assets and unknown API routes', async () => {
    const asset = await fetch(`${server.url}/assets/missing.js`);
    expect(asset.status).toBe(404);

    const api = await fetch(`${server.url}/api/not-found`, { method: 'POST', body: '{}' });
    expect(api.status).toBe(404);
  });

  it('rejects non-POST API requests', async () => {
    const response = await fetch(`${server.url}/api/ai/test`);
    expect(response.status).toBe(405);
  });

  it('returns a friendly error when AI is not configured', async () => {
    const response = await fetch(`${server.url}/api/ai/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain('AI 服务未配置');
  });

  it('returns 400 for malformed JSON', async () => {
    const response = await fetch(`${server.url}/api/ai/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });
    expect(response.status).toBe(400);
  });

  it('validates mail payloads without opening network connections', async () => {
    const mailTest = await fetch(`${server.url}/api/mail/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(mailTest.status).toBe(500);
    expect((await mailTest.json()) as { error: string }).toMatchObject({ error: expect.stringContaining('host') });

    const mailSend = await fetch(`${server.url}/api/mail/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(mailSend.status).toBe(200);
    expect((await mailSend.json()) as { ok: boolean }).toMatchObject({ ok: false });
  });

  it('blocks path traversal outside dist', async () => {
    const response = await fetch(`${server.url}/..%2f..%2fetc%2fpasswd`);
    expect(response.status).toBe(403);
  });
});
