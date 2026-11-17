import { app, BrowserWindow, dialog, session, shell } from 'electron';
import path from 'node:path';
import { startLocalServer, type LocalServer } from './localServer';

const rendererUrl = process.env.ELECTRON_RENDERER_URL;
const isDevRenderer = Boolean(rendererUrl);

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

let mainWindow: BrowserWindow | null = null;
let localServer: LocalServer | null = null;
let allowedOrigin = '';

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const isInternalUrl = (url: string): boolean => {
  try {
    return new URL(url).origin === allowedOrigin;
  } catch {
    return false;
  }
};

const openExternalUrl = (url: string): void => {
  if (/^(https?:|mailto:)/i.test(url)) {
    void shell.openExternal(url);
  }
};

/** 生产环境注入 CSP；开发环境保留 Vite HMR 所需的宽松策略 */
const applyContentSecurityPolicy = (): void => {
  if (isDevRenderer) return;

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CONTENT_SECURITY_POLICY],
      },
    });
  });
};

const createWindow = async (): Promise<void> => {
  let targetUrl: string;

  if (isDevRenderer && rendererUrl) {
    targetUrl = rendererUrl;
  } else {
    localServer = await startLocalServer(path.join(app.getAppPath(), 'dist'));
    targetUrl = localServer.url;
  }

  allowedOrigin = new URL(targetUrl).origin;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    title: 'MailTools',
    backgroundColor: '#f7f8fa',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      backgroundThrottling: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 外部链接交给系统浏览器，禁止在应用窗口内打开新页面
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: 'deny' };
  });

  // 阻止应用被导航到外部站点（如用户拖入链接）
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isInternalUrl(url)) {
      event.preventDefault();
      openExternalUrl(url);
    }
  });

  mainWindow.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });

  await mainWindow.loadURL(targetUrl);
};

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.setAppUserModelId('com.mailtools.desktop');

  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    applyContentSecurityPolicy();
    await createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void createWindow();
      }
    });
  }).catch((err: unknown) => {
    dialog.showErrorBox('MailTools 启动失败', errorMessage(err));
    app.quit();
  });

  app.on('before-quit', () => {
    if (localServer) {
      void localServer.close().catch(() => undefined);
      localServer = null;
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
