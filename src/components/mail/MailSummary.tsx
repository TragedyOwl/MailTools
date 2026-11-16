import { AlertCircle, Calendar, CheckSquare, ListChecks, ListTodo, RefreshCw, Sparkles, Square } from 'lucide-react';
import type { Mail, Todo } from '@/types';
import { cn } from '@/utils/cn';
import { CATEGORY_LABELS, CATEGORY_STYLES, PRIORITY_LABELS, PRIORITY_STYLES } from '@/utils/constants';
import { formatDeadline } from '@/utils/datetime';
import { Badge } from '@/components/common/Badge';

interface MailSummaryProps {
  mail: Mail;
  /** 该邮件已关联的待办（用于勾选状态、跳转与完成切换） */
  mailTodos?: Todo[];
  onCreateTodo?: (content: string, deadline?: string) => void;
  /** 切换关联待办的完成状态 */
  onToggleTodo?: (todoId: string) => void;
  /** 跳转到待办清单并定位该待办 */
  onOpenTodo?: (todoId: string) => void;
  /** 跳转到日历并定位待办对应日程 */
  onOpenCalendar?: (eventId: string) => void;
  /** 摘要生成失败（本地降级）时的重试回调 */
  onRetry?: (mailId: string) => void;
}

/** AI 标准化摘要卡片（主题/发件人/紧急度/类别/核心内容/关键信息点/待办事项） */
export const MailSummaryCard = ({
  mail,
  mailTodos,
  onCreateTodo,
  onToggleTodo,
  onOpenTodo,
  onOpenCalendar,
  onRetry,
}: MailSummaryProps) => {
  const summary = mail.summary;

  if (!summary) {
    return (
      <div className="rounded-panel border border-dashed border-surface-border p-4 dark:border-gray-700">
        <div className="flex items-center gap-2 text-sm text-ink-muted dark:text-gray-400">
          <Sparkles size={15} className="animate-pulse text-brand-pink" />
          AI 摘要生成中…
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-panel bg-gradient-to-br from-primary-50 via-white to-[#fdf2fb] p-4 shadow-card dark:from-gray-800 dark:via-gray-800 dark:to-gray-800">
      {/* 标题行 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-ink dark:text-gray-100">
          <Sparkles size={15} className="text-brand-pink" />
          AI 邮件摘要
          {summary.source === 'local' && (
            <>
              <span className="text-[10px] font-normal text-amber-500">（生成失败）</span>
              {onRetry && (
                <button
                  onClick={() => onRetry(mail.id)}
                  className="flex items-center gap-1 rounded-md bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-600 transition-colors hover:bg-primary-100 dark:bg-primary-950/50 dark:text-primary-400 dark:hover:bg-primary-900/50"
                  title="重新生成 AI 摘要并提取待办/日历"
                >
                  <RefreshCw size={11} />
                  重试
                </button>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Badge className={PRIORITY_STYLES[mail.priority].badge}>{PRIORITY_LABELS[mail.priority]}优先级</Badge>
          <Badge className={CATEGORY_STYLES[mail.category].badge}>{CATEGORY_LABELS[mail.category]}</Badge>
        </div>
      </div>

      {/* 核心内容 */}
      <p className="mb-3 text-sm leading-6 text-ink dark:text-gray-200">{summary.coreContent}</p>

      {/* 关键信息点 */}
      {summary.keyPoints.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-ink-secondary dark:text-gray-300">
            <ListChecks size={13} />
            关键信息点
          </p>
          <ul className="flex flex-col gap-1">
            {summary.keyPoints.map((point, index) => (
              <li key={index} className="flex items-start gap-1.5 text-xs leading-5 text-ink-secondary dark:text-gray-400">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary-400" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 待办事项 */}
      {summary.actionItems.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-ink-secondary dark:text-gray-300">
            <CheckSquare size={13} />
            待办事项
          </p>
          <ul className="flex flex-col gap-1">
            {summary.actionItems.map((item, index) => {
              const todo = mailTodos?.find((t) => t.content === item.content);
              const deadline = item.deadline ? formatDeadline(item.deadline) : null;
              return (
                <li key={index} className="flex items-center gap-2 text-xs text-ink-secondary dark:text-gray-400">
                  {todo ? (
                    <>
                      {/* 勾选切换完成状态 */}
                      <button
                        onClick={() => onToggleTodo?.(todo.id)}
                        className={cn(
                          'shrink-0 transition-colors',
                          todo.completed ? 'text-emerald-500' : 'text-ink-muted hover:text-primary-500'
                        )}
                        title={todo.completed ? '标记为未完成' : '标记为已完成'}
                      >
                        {todo.completed ? <CheckSquare size={13} /> : <Square size={13} />}
                      </button>
                      <span className={cn(todo.completed && 'line-through opacity-60')}>{item.content}</span>
                      {/* 跳转到待办清单 */}
                      {onOpenTodo && (
                        <button
                          onClick={() => onOpenTodo(todo.id)}
                          className="flex shrink-0 items-center gap-0.5 rounded px-1 py-px text-[10px] text-primary-600 transition-colors hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950/40"
                          title="跳转到待办清单并定位"
                        >
                          <ListTodo size={11} />
                          待办
                        </button>
                      )}
                      {/* 跳转到日历日程 */}
                      {todo.calendarEventId && onOpenCalendar && (
                        <button
                          onClick={() => todo.calendarEventId && onOpenCalendar(todo.calendarEventId)}
                          className="flex shrink-0 items-center gap-0.5 rounded px-1 py-px text-[10px] text-primary-600 transition-colors hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950/40"
                          title="跳转到日历查看日程"
                        >
                          <Calendar size={11} />
                          日历
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        disabled={!onCreateTodo}
                        onClick={() => onCreateTodo?.(item.content, item.deadline)}
                        className="shrink-0 text-ink-muted transition-colors hover:text-primary-500"
                        title="点击加入待办清单"
                      >
                        <Square size={13} />
                      </button>
                      <span>{item.content}</span>
                    </>
                  )}
                  {deadline && (
                    <span className={cn('flex items-center gap-0.5 text-[10px]', deadline.overdue ? 'text-red-500' : 'text-ink-muted')}>
                      <AlertCircle size={10} />
                      {deadline.text}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
