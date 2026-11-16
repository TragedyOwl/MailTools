import { CalendarPlus, Check, ExternalLink, Sparkles, Trash2 } from 'lucide-react';
import { memo } from 'react';
import type { Todo } from '@/types';
import { cn } from '@/utils/cn';
import { PRIORITY_LABELS, PRIORITY_STYLES } from '@/utils/constants';
import { formatDeadline } from '@/utils/datetime';

interface TodoItemProps {
  todo: Todo;
  /** 跳转定位时短暂高亮显示 */
  highlighted?: boolean;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onAddToCalendar: (id: string) => void;
  onOpenSource?: (mailId: string) => void;
}

/** 待办条目 */
export const TodoItem = memo(({ todo, highlighted, onToggle, onRemove, onAddToCalendar, onOpenSource }: TodoItemProps) => {
  const deadline = todo.deadline ? formatDeadline(todo.deadline) : null;

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-panel bg-white p-3.5 shadow-card transition-shadow hover:shadow-elevated dark:bg-gray-800',
        todo.completed && 'opacity-60',
        highlighted && 'ring-2 ring-primary-400 dark:ring-primary-500'
      )}
    >
      {/* 勾选框 */}
      <button
        onClick={() => onToggle(todo.id)}
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
          todo.completed ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 hover:border-primary-500 dark:border-gray-600'
        )}
        aria-label={todo.completed ? '标记未完成' : '标记完成'}
      >
        {todo.completed && <Check size={13} strokeWidth={3} />}
      </button>

      {/* 内容 */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className={cn('text-sm text-ink dark:text-gray-100', todo.completed && 'line-through')}>{todo.content}</p>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-ink-muted dark:text-gray-500">
          <span className={cn('rounded px-1 py-px text-[10px] font-medium', PRIORITY_STYLES[todo.priority].badge)}>
            {PRIORITY_LABELS[todo.priority]}优先级
          </span>
          {deadline && (
            <span className={cn(deadline.overdue && !todo.completed && 'font-medium text-red-500')}>
              截止 {deadline.text}
              {deadline.overdue && !todo.completed && '（已逾期）'}
            </span>
          )}
          {todo.source === 'ai' && (
            <span className="flex items-center gap-0.5">
              <Sparkles size={10} className="text-brand-pink" />
              AI 提取
            </span>
          )}
          {todo.calendarEventId && <span className="text-primary-500">已加入日历</span>}
        </div>
      </div>

      {/* 操作 */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {todo.sourceMailId && onOpenSource && (
          <button
            onClick={() => todo.sourceMailId && onOpenSource(todo.sourceMailId)}
            className="rounded-full p-1.5 text-ink-muted hover:bg-black/5 hover:text-primary-500 dark:hover:bg-white/10"
            title="查看来源邮件"
          >
            <ExternalLink size={14} />
          </button>
        )}
        {!todo.calendarEventId && !todo.completed && (
          <button
            onClick={() => onAddToCalendar(todo.id)}
            className="rounded-full p-1.5 text-ink-muted hover:bg-black/5 hover:text-primary-500 dark:hover:bg-white/10"
            title={todo.deadline ? '加入日历' : '安排时间并加入日历'}
          >
            <CalendarPlus size={14} />
          </button>
        )}
        <button
          onClick={() => onRemove(todo.id)}
          className="rounded-full p-1.5 text-ink-muted hover:bg-black/5 hover:text-red-500 dark:hover:bg-white/10"
          title="删除"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
});

TodoItem.displayName = 'TodoItem';
