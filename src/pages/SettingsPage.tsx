import { CheckCircle2, Database, Eye, EyeOff, Loader2, Mail, Palette, RefreshCw, Send, ShieldCheck, Sparkles, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { SmtpServerConfig, SyncIntervalMinutes, ThemeMode } from '@/types';
import { useCalendarStore } from '@/stores/calendarStore';
import { useContactStore } from '@/stores/contactStore';
import { useMailStore } from '@/stores/mailStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTaskStore } from '@/stores/taskStore';
import { useTodoStore } from '@/stores/todoStore';
import { mailRepository } from '@/db/mailRepository';
import { taskRepository } from '@/db/taskRepository';
import { todoRepository } from '@/db/todoRepository';
import { eventRepository } from '@/db/eventRepository';
import { testConnection } from '@/services/mailService';
import { testAIConnection } from '@/services/aiService';
import { generateDemoData } from '@/utils/demoData';
import { cn } from '@/utils/cn';
import { DEFAULT_IMAP_PRESET, DEFAULT_SMTP_PRESET } from '@/utils/constants';
import { Button } from '@/components/common/Button';
import { ConfirmModal } from '@/components/common/ConfirmModal';

/** 设置区块容器 */
const Section = ({ icon: Icon, title, description, children }: { icon: typeof Mail; title: string; description: string; children: ReactNode }) => (
  <section className="flex flex-col gap-4 rounded-panel bg-white p-5 shadow-card dark:bg-gray-800">
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950 dark:text-primary-400">
        <Icon size={17} />
      </div>
      <div>
        <h2 className="font-display text-sm font-semibold text-ink dark:text-gray-100">{title}</h2>
        <p className="mt-0.5 text-xs leading-5 text-ink-muted dark:text-gray-500">{description}</p>
      </div>
    </div>
    {children}
  </section>
);

/** 开关 */
const Toggle = ({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) => (
  <button onClick={() => onChange(!checked)} className="flex w-full items-center justify-between py-1 text-left">
    <span>
      <span className="block text-sm text-ink dark:text-gray-100">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-ink-muted dark:text-gray-500">{hint}</span>}
    </span>
    <span className={cn('relative h-[22px] w-10 shrink-0 rounded-full transition-colors', checked ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600')}>
      <span
        className={cn(
          'absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-all',
          checked ? 'left-[22px]' : 'left-[3px]'
        )}
      />
    </span>
  </button>
);

const SYNC_INTERVALS: Array<{ value: SyncIntervalMinutes; label: string }> = [
  { value: 5, label: '5 分钟' },
  { value: 15, label: '15 分钟' },
  { value: 30, label: '30 分钟' },
];

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: 'light', label: '浅色模式' },
  { value: 'dark', label: '深色模式' },
];

const inputClass = 'input-base';
const labelClass = 'mb-1 block text-xs text-ink-muted dark:text-gray-500';

/** 设置页：邮箱 / AI / 同步偏好 / 隐私与主题 / 数据管理 */
export const SettingsPage = () => {
  const account = useSettingsStore((s) => s.mailAccount);
  const ai = useSettingsStore((s) => s.ai);
  const syncIntervalMinutes = useSettingsStore((s) => s.syncIntervalMinutes);
  const autoSyncOnOpen = useSettingsStore((s) => s.autoSyncOnOpen);
  const privacyMode = useSettingsStore((s) => s.privacyMode);
  const theme = useSettingsStore((s) => s.theme);

  const mailCount = useMailStore((s) => s.mails.length);
  const taskCount = useTaskStore((s) => s.tasks.length);
  const todoCount = useTodoStore((s) => s.todos.length);
  const eventCount = useCalendarStore((s) => s.events.length);

  // 邮箱表单
  const [host, setHost] = useState(account?.host ?? DEFAULT_IMAP_PRESET.host);
  const [port, setPort] = useState(String(account?.port ?? DEFAULT_IMAP_PRESET.port));
  const [secure, setSecure] = useState(account?.secure ?? DEFAULT_IMAP_PRESET.secure);
  const [user, setUser] = useState(account?.user ?? '');
  const [password, setPassword] = useState('');
  const [smtpHost, setSmtpHost] = useState(account?.smtp?.host ?? DEFAULT_SMTP_PRESET.host);
  const [smtpPort, setSmtpPort] = useState(String(account?.smtp?.port ?? DEFAULT_SMTP_PRESET.port));
  const [smtpSecure, setSmtpSecure] = useState(account?.smtp?.secure ?? DEFAULT_SMTP_PRESET.secure);
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [accountSaved, setAccountSaved] = useState(false);
  const [confirmClearAccount, setConfirmClearAccount] = useState(false);

  // AI 表单
  const [aiBaseUrl, setAiBaseUrl] = useState(ai.baseUrl);
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState(ai.model);
  const [aiSaved, setAiSaved] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  // 数据管理
  const [confirmDemo, setConfirmDemo] = useState(false);
  const [confirmClearData, setConfirmClearData] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [syncReset, setSyncReset] = useState(false);

  /** 组合当前表单的账号输入（密码留空时复用已保存密码） */
  const buildAccountInput = () => {
    const portNum = Number(port);
    if (!host.trim() || !Number.isInteger(portNum) || portNum <= 0 || !user.trim()) return null;
    const pwd = password.trim() || useSettingsStore.getState().getDecryptedAccount()?.password || '';
    if (!pwd) return null;
    // SMTP 为可选项：主机留空表示不配置发件服务器
    const smtpPortNum = Number(smtpPort);
    const smtp: SmtpServerConfig | undefined = smtpHost.trim()
      ? {
          host: smtpHost.trim(),
          port: Number.isInteger(smtpPortNum) && smtpPortNum > 0 ? smtpPortNum : DEFAULT_SMTP_PRESET.port,
          secure: smtpSecure,
        }
      : undefined;
    return { host: host.trim(), port: portNum, secure, user: user.trim(), password: pwd, smtp };
  };

  const handleTest = async (): Promise<void> => {
    const input = buildAccountInput();
    if (!input) {
      setTestResult({ ok: false, text: '请完整填写服务器、端口、邮箱账号与密码' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testConnection(input);
      if (!res.ok) {
        setTestResult({ ok: false, text: `收件 IMAP 连接失败：${res.error ?? '未知错误'}` });
        return;
      }
      const parts = [`收件 IMAP 连接成功，收件箱共 ${res.total ?? 0} 封邮件`];
      if (res.smtp) {
        parts.push(res.smtp.ok ? '发件 SMTP 连接成功' : `发件 SMTP 连接失败：${res.smtp.error ?? '未知错误'}`);
      }
      const smtpFailed = Boolean(res.smtp && !res.smtp.ok);
      setTestResult({ ok: !smtpFailed, text: parts.join('；') });
    } catch (err) {
      setTestResult({ ok: false, text: err instanceof Error ? err.message : '连接失败' });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveAccount = (): void => {
    const input = buildAccountInput();
    if (!input) {
      setTestResult({ ok: false, text: '请完整填写服务器、端口、邮箱账号与密码' });
      return;
    }
    useSettingsStore.getState().setMailAccount(input);
    setPassword('');
    setAccountSaved(true);
    setTestResult(null);
    window.setTimeout(() => setAccountSaved(false), 2000);
  };

  const handleSaveAI = (): void => {
    const apiKey = aiApiKey.trim() || useSettingsStore.getState().getDecryptedAI()?.apiKey || '';
    useSettingsStore.getState().setAIConfig({ baseUrl: aiBaseUrl.trim(), apiKey, model: aiModel.trim() });
    setAiApiKey('');
    setAiSaved(true);
    window.setTimeout(() => setAiSaved(false), 2000);
  };

  /** 测试 AI 密钥与端点（使用当前表单值，Key 留空时复用已保存的） */
  const handleTestAI = async (): Promise<void> => {
    const baseUrl = aiBaseUrl.trim();
    const model = aiModel.trim();
    const apiKey = aiApiKey.trim() || useSettingsStore.getState().getDecryptedAI()?.apiKey || '';
    if (!baseUrl || !apiKey || !model) {
      setAiTestResult({ ok: false, text: '请先填写 API 地址、Key 与模型' });
      return;
    }
    setAiTesting(true);
    setAiTestResult(null);
    try {
      const res = await testAIConnection({ baseUrl, apiKey, model });
      setAiTestResult({ ok: res.ok, text: res.ok ? (res.message ?? '连接成功') : (res.error ?? '连接失败') });
    } catch (err) {
      setAiTestResult({ ok: false, text: err instanceof Error ? err.message : '连接失败' });
    } finally {
      setAiTesting(false);
    }
  };

  const handleLoadDemo = async (): Promise<void> => {
    setLoadingDemo(true);
    try {
      const demo = generateDemoData();
      await Promise.all([
        useMailStore.getState().reset(),
        useTaskStore.getState().reset(),
        useTodoStore.getState().reset(),
        useCalendarStore.getState().reset(),
        useContactStore.getState().reset(),
      ]);
      await Promise.all([
        mailRepository.bulkPut(demo.mails),
        taskRepository.bulkPut(demo.tasks),
        todoRepository.bulkPut(demo.todos),
        ...demo.events.map((event) => eventRepository.put(event)),
      ]);
      useMailStore.getState().initFrom(demo.mails);
      useTaskStore.getState().initFrom(demo.tasks);
      useTodoStore.getState().initFrom(demo.todos);
      useCalendarStore.getState().initFrom(demo.events);
      // 演示邮件的地址写入地址簿（按时间顺序累加往来次数）
      for (const mail of [...demo.mails].sort((a, b) => a.date.localeCompare(b.date))) {
        await useContactStore.getState().recordContacts([mail.from, ...mail.to, ...(mail.cc ?? [])], mail.date);
      }
      setConfirmDemo(false);
    } finally {
      setLoadingDemo(false);
    }
  };

  const handleClearData = async (): Promise<void> => {
    await Promise.all([
      useMailStore.getState().reset(),
      useTaskStore.getState().reset(),
      useTodoStore.getState().reset(),
      useCalendarStore.getState().reset(),
      useContactStore.getState().reset(),
    ]);
    setConfirmClearData(false);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-surface-divider bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
        <h1 className="font-display text-base font-semibold text-ink dark:text-gray-100">设置</h1>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 overflow-y-auto p-4 md:p-5">
        {/* 邮箱配置 */}
        <Section icon={Mail} title="邮箱配置" description="配置企业 IMAP 邮箱，密码经 AES-256 加密后仅存储在本地浏览器">
          {account && (
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
              <span>
                已配置：{account.user} @ {account.host}:{account.port}
                {account.smtp?.host ? ` · SMTP ${account.smtp.host}:${account.smtp.port}` : ''}
              </span>
              <button onClick={() => setConfirmClearAccount(true)} className="font-medium text-red-500 hover:underline">
                清除
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className={labelClass}>IMAP 服务器</label>
              <input value={host} onChange={(e) => setHost(e.target.value)} className={inputClass} placeholder="imap.example.com" />
            </div>
            <div>
              <label className={labelClass}>端口</label>
              <input value={port} onChange={(e) => setPort(e.target.value)} className={inputClass} inputMode="numeric" placeholder="993" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className={labelClass}>邮箱账号</label>
              <input value={user} onChange={(e) => setUser(e.target.value)} className={inputClass} placeholder="name@company.com" autoComplete="username" />
            </div>
            <div>
              <label className={labelClass}>密码 / 授权码{account && '（留空则不修改）'}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(inputClass, 'pr-9')}
                  placeholder={account ? '••••••••' : '邮箱密码或客户端授权码'}
                  autoComplete="current-password"
                />
                <button
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>
          <Toggle checked={secure} onChange={setSecure} label="收件使用 SSL/TLS 加密连接" hint="端口 993 通常需要开启，端口 143 通常关闭" />
          {/* 发件服务器（可选，凭据复用上方账号与授权码） */}
          <div className="flex flex-col gap-3 rounded-lg bg-black/[0.02] p-3 dark:bg-white/5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary dark:text-gray-300">
              <Send size={12} />
              发件服务器 SMTP（可选，用于回复 / 转发）
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className={labelClass}>SMTP 服务器</label>
                <input
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  className={inputClass}
                  placeholder="smtp.example.com（留空则不配置）"
                />
              </div>
              <div>
                <label className={labelClass}>端口</label>
                <input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} className={inputClass} inputMode="numeric" placeholder="465" />
              </div>
            </div>
            <Toggle checked={smtpSecure} onChange={setSmtpSecure} label="发件使用 SSL/TLS 直连" hint="端口 465 通常开启，端口 587（STARTTLS）通常关闭" />
          </div>
          {testResult && (
            <p
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs',
                testResult.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400'
              )}
            >
              {testResult.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
              {testResult.text}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => void handleTest()} disabled={testing}>
              {testing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {testing ? '测试中…' : '测试连接'}
            </Button>
            <Button size="sm" onClick={handleSaveAccount}>
              {accountSaved ? <CheckCircle2 size={13} /> : null}
              {accountSaved ? '已保存' : '保存配置'}
            </Button>
          </div>
        </Section>

        {/* AI 配置 */}
        <Section icon={Sparkles} title="AI 摘要配置" description="支持任意 OpenAI 兼容接口；Key 加密存储在本地。留空则使用服务端环境变量配置">
          <div>
            <label className={labelClass}>API 地址（Base URL）</label>
            <input value={aiBaseUrl} onChange={(e) => setAiBaseUrl(e.target.value)} className={inputClass} placeholder="https://api.openai.com/v1" />
            <p className="mt-1 text-xs leading-5 text-ink-muted dark:text-gray-500">
              默认自动追加 <code className="rounded bg-black/[0.05] px-1 dark:bg-white/10">/chat/completions</code>；在地址末尾添加
              <code className="rounded bg-black/[0.05] px-1 dark:bg-white/10">#</code> 可禁用自动追加，将地址作为完整请求端点直接调用（如
              <code className="rounded bg-black/[0.05] px-1 dark:bg-white/10">http://host/api/llm#</code>）
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className={labelClass}>API Key{ai.encryptedApiKey && '（留空则不修改）'}</label>
              <input
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                className={inputClass}
                placeholder={ai.encryptedApiKey ? '••••••••' : 'sk-...'}
                autoComplete="off"
              />
            </div>
            <div>
              <label className={labelClass}>模型</label>
              <input value={aiModel} onChange={(e) => setAiModel(e.target.value)} className={inputClass} placeholder="gpt-4o-mini" />
            </div>
          </div>
          {aiTestResult && (
            <p
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs',
                aiTestResult.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400'
              )}
            >
              {aiTestResult.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
              {aiTestResult.text}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => void handleTestAI()} disabled={aiTesting}>
              {aiTesting ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {aiTesting ? '测试中…' : '测试连接'}
            </Button>
            <Button size="sm" onClick={handleSaveAI}>
              {aiSaved ? <CheckCircle2 size={13} /> : null}
              {aiSaved ? '已保存' : '保存配置'}
            </Button>
          </div>
        </Section>

        {/* 同步偏好 */}
        <Section icon={RefreshCw} title="同步偏好" description="控制邮件自动拉取的频率与时机">
          <div>
            <p className={cn(labelClass, 'mb-1.5')}>自动同步间隔</p>
            <div className="flex items-center gap-1.5">
              {SYNC_INTERVALS.map((item) => (
                <button
                  key={item.value}
                  onClick={() => useSettingsStore.getState().setSyncInterval(item.value)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs transition-colors',
                    syncIntervalMinutes === item.value
                      ? 'bg-primary-500 text-white'
                      : 'bg-black/[0.04] text-ink-secondary hover:bg-black/[0.08] dark:bg-white/10 dark:text-gray-300'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <Toggle
            checked={autoSyncOnOpen}
            onChange={(v) => useSettingsStore.getState().setAutoSyncOnOpen(v)}
            label="打开应用时自动同步"
            hint="启动应用后立即拉取一次最新邮件"
          />
          <div>
            <p className={cn(labelClass, 'mb-1.5')}>同步状态修复</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                useSettingsStore.getState().setLastUid(0);
                setSyncReset(true);
                window.setTimeout(() => setSyncReset(false), 2000);
              }}
            >
              {syncReset ? <CheckCircle2 size={13} /> : <RefreshCw size={13} />}
              {syncReset ? '已重置' : '重置同步进度'}
            </Button>
            <p className="mt-1.5 text-xs text-ink-muted dark:text-gray-500">
              当邮箱有邮件但同步始终为空时使用；重置后下次同步将按收件箱选择的范围重新拉取
            </p>
          </div>
        </Section>

        {/* 隐私与外观 */}
        <Section icon={ShieldCheck} title="隐私与外观" description="所有数据均存储在本地浏览器，不会上传到除 AI 摘要接口外的任何服务器">
          <Toggle
            checked={privacyMode}
            onChange={(v) => useSettingsStore.getState().setPrivacyMode(v)}
            label="隐私模式"
            hint="开启后不使用外部 AI，改用本地规则生成摘要，邮件内容完全不出设备"
          />
          <div>
            <p className={cn(labelClass, 'mb-1.5 flex items-center gap-1')}>
              <Palette size={11} />
              界面主题
            </p>
            <div className="flex items-center gap-1.5">
              {THEME_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  onClick={() => useSettingsStore.getState().setTheme(item.value)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs transition-colors',
                    theme === item.value
                      ? 'bg-ink-charcoal text-white dark:bg-primary-600'
                      : 'bg-black/[0.04] text-ink-secondary hover:bg-black/[0.08] dark:bg-white/10 dark:text-gray-300'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* 数据管理 */}
        <Section icon={Database} title="数据管理" description="本地数据存储于浏览器 IndexedDB，清除浏览器数据将导致丢失">
          <p className="rounded-lg bg-black/[0.03] px-3 py-2 text-xs text-ink-secondary dark:bg-white/5 dark:text-gray-400">
            当前数据：{mailCount} 封邮件 · {taskCount} 个任务 · {todoCount} 项待办 · {eventCount} 个日程
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmDemo(true)} disabled={loadingDemo}>
              {loadingDemo ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              加载演示数据
            </Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmClearData(true)}>
              <Trash2 size={13} />
              清空本地数据
            </Button>
          </div>
        </Section>
      </div>

      {/* 确认弹窗 */}
      <ConfirmModal
        open={confirmClearAccount}
        title="清除邮箱配置"
        message="清除后将无法同步邮件（已同步的本地数据保留）。确定清除邮箱配置吗？"
        confirmText="清除"
        onConfirm={() => {
          useSettingsStore.getState().clearMailAccount();
          setConfirmClearAccount(false);
        }}
        onCancel={() => setConfirmClearAccount(false)}
      />
      <ConfirmModal
        open={confirmDemo}
        title="加载演示数据"
        message="加载演示数据将清空当前全部本地数据（邮件 / 任务 / 待办 / 日程），用于快速体验产品功能。确定继续吗？"
        confirmText="加载"
        onConfirm={() => void handleLoadDemo()}
        onCancel={() => setConfirmDemo(false)}
      />
      <ConfirmModal
        open={confirmClearData}
        title="清空本地数据"
        message="将删除全部本地邮件、任务、待办与日程数据（邮箱与 AI 配置保留）。此操作不可恢复，确定继续吗？"
        confirmText="清空"
        onConfirm={() => void handleClearData()}
        onCancel={() => setConfirmClearData(false)}
      />
    </div>
  );
};
