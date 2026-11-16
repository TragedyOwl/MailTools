import { CheckCircle2, ChevronUp, Loader2, Sparkles, Trash2, X, XCircle } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { cn } from '@/utils/cn';
import { formatTime } from '@/utils/datetime';
import { useAiSummaryStatusStore, type AiSummaryLog } from '@/stores/aiSummaryStatusStore';
import { useMailStore } from '@/stores/mailStore';

/** 单条日志的状态图标 */
const LogStatusIcon = ({ status }: { status: AiSummaryLog['status'] }) => {
  if (status === 'running') return <Loader2 size={13} className="shrink-0 animate-spin text-primary-500" />;
  if (status === 'success') return <CheckCircle2 size={13} className="shrink-0 text-green-500" />;
  return <XCircle size={13} className="shrink-0 text-red-500" />;
};

/**
 * 模型输出展示区（网络级实时流式）：
 * output 随 SSE 增量到达而实时增长，直接渲染即为天然的逐字输出效果；
 * 占位态（等待响应）与消息态共用同一固定尺寸容器（h-24 w-full），内容超出时内部滚动，
 * 从而在文字出现 / 增长过程中容器宽高恒定，杜绝布局偏移与页面跳动。
 */
const OutputBox = ({ output, running }: { output?: string; running: boolean }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 网络流追加时自动滚到底部，跟随最新输出
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [output]);

  const waiting = running && !output;

  return (
    <div
      ref={scrollRef}
      className="mt-1.5 h-24 w-full overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-surface-soft px-2 py-1.5 font-mono text-[11px] leading-relaxed text-ink-secondary dark:bg-black/20 dark:text-gray-400"
    >
      {waiting ? '正在调用 AI，等待模型响应' : output}
      {running && <span className="ml-0.5 inline-block h-3 w-[2px] translate-y-[2px] animate-pulse bg-brand-pink" />}
    </div>
  );
};

/** 详情面板：逐封执行日志清单 + 失败重试 */
const DetailPanel = () => {
  const logs = useAiSummaryStatusStore((s) => s.logs);
  const active = useAiSummaryStatusStore((s) => s.active);
  const done = useAiSummaryStatusStore((s) => s.done);
  const total = useAiSummaryStatusStore((s) => s.total);
  const setExpanded = useAiSummaryStatusStore((s) => s.setExpanded);
  const clearLogs = useAiSummaryStatusStore((s) => s.clearLogs);

  const handleRetry = (mailId: string): void => {
    useMailStore.getState().retrySummary(mailId);
  };

  return (
    <div className="fixed bottom-32 right-4 z-50 flex max-h-[60vh] w-[340px] flex-col overflow-hidden rounded-panel border border-surface-border bg-white shadow-elevated md:bottom-16 dark:border-gray-700 dark:bg-gray-900">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-surface-divider px-4 py-3 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className={cn('text-brand-pink', active && 'animate-pulse')} />
          <span className="text-sm font-semibold text-ink dark:text-gray-100">AI 摘要详情</span>
          {active && total > 0 && (
            <span className="text-[11px] text-ink-muted dark:text-gray-500">
              {done}/{total}
            </span>
          )}
        </div>
        <button
          onClick={() => setExpanded(false)}
          className="rounded-full p-1 text-ink-muted transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          title="收起"
        >
          <X size={15} />
        </button>
      </div>

      {/* 日志清单 */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {logs.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-ink-muted dark:text-gray-500">暂无摘要处理记录</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {logs.map((log) => (
              <li
                key={log.id}
                className="rounded-lg border border-surface-divider px-3 py-2 dark:border-gray-800"
              >
                <div className="flex items-start gap-2">
                  <LogStatusIcon status={log.status} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink dark:text-gray-200" title={log.subject}>
                      {log.subject}
                    </p>
                    <p
                      className={cn(
                        'mt-0.5 text-[11px]',
                        log.status === 'error' ? 'text-red-500' : 'text-ink-muted dark:text-gray-500'
                      )}
                    >
                      {log.status === 'error' ? log.error ?? log.stage : log.stage}
                    </p>
                    <p className="mt-0.5 text-[10px] text-ink-muted/70 dark:text-gray-600">{formatTime(log.at)}</p>
                  </div>
                  {log.status === 'error' && (
                    <button
                      onClick={() => handleRetry(log.mailId)}
                      className="shrink-0 rounded-full border border-surface-border px-2 py-0.5 text-[11px] text-primary-500 transition-colors hover:bg-primary-50 dark:border-gray-700 dark:hover:bg-white/10"
                      title="重新生成该邮件摘要"
                    >
                      重试
                    </button>
                  )}
                </div>
                {/* 模型输出区：调用中显示占位，拿到返回后打字机逐字播放（容器尺寸恒定防偏移） */}
                {(log.status === 'running' || log.output) && (
                  <OutputBox output={log.output} running={log.status === 'running'} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 底部操作 */}
      {logs.length > 0 && (
        <div className="border-t border-surface-divider px-4 py-2 dark:border-gray-800">
          <button
            onClick={clearLogs}
            className="flex items-center gap-1.5 text-[11px] text-ink-muted transition-colors hover:text-red-500 dark:text-gray-500"
          >
            <Trash2 size={12} />
            清空记录
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * AI 摘要状态条（右下角浮动胶囊）：
 * 折叠态滚动展示当前处理阶段文字与进度，点击展开详情面板（堆叠于胶囊上方）查看逐封执行日志与失败重试。
 */
export const AiSummaryStatusBar = () => {
  const active = useAiSummaryStatusStore((s) => s.active);
  const stageText = useAiSummaryStatusStore((s) => s.stageText);
  const done = useAiSummaryStatusStore((s) => s.done);
  const total = useAiSummaryStatusStore((s) => s.total);
  const logs = useAiSummaryStatusStore((s) => s.logs);
  const expanded = useAiSummaryStatusStore((s) => s.expanded);
  const setExpanded = useAiSummaryStatusStore((s) => s.setExpanded);

  // 无处理任务且无历史记录时不显示
  if (!active && logs.length === 0) return null;

  const errorCount = logs.filter((log) => log.status === 'error').length;

  return (
    <>
      <button
        onClick={() => setExpanded(!expanded)}
        className="fixed bottom-20 right-4 z-50 flex w-72 items-center gap-2 rounded-full border border-surface-border bg-white px-3.5 py-2 text-left shadow-elevated transition-colors hover:bg-primary-50 md:bottom-4 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-white/10"
        title="查看 AI 摘要详情"
      >
        <Sparkles size={13} className={cn('shrink-0 text-brand-pink', active && 'animate-pulse')} />
        {/* 滚动阶段文字：stageText 变化时淡入上滑 */}
        <span key={stageText} className="min-w-0 flex-1 animate-fade-slide truncate text-[11px] text-primary-600 dark:text-primary-300">
          {stageText || 'AI 摘要'}
        </span>
        {active && total > 0 && (
          <span className="shrink-0 text-[10px] tabular-nums text-primary-500 dark:text-primary-400">
            {done}/{total}
          </span>
        )}
        {errorCount > 0 && !active && (
          <span className="shrink-0 rounded-full bg-red-500 px-1.5 text-[10px] font-semibold leading-4 text-white">
            {errorCount}
          </span>
        )}
        <ChevronUp size={13} className={cn('shrink-0 text-ink-muted transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && <DetailPanel />}
    </>
  );
};
