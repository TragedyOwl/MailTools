import { CheckCircle2, Circle, Archive } from 'lucide-react';
import { memo } from 'react';
import type { Task, TaskStatus } from '@/types';
import { cn } from '@/utils/cn';
import { CATEGORY_LABELS, CATEGORY_STYLES, PRIORITY_STYLES } from '@/utils/constants';
import { formatMailTime } from '@/utils/datetime';

interface TaskCardProps {
  task: Task;
  active: boolean;
  mergeMode: boolean;
  mergeSelected: boolean;
  onSelect: (id: string) => void;
}

const STATUS_META: Record<TaskStatus, { label: string; className: string }> = {
  active: { label: '进行中', className: 'bg-primary-50 text-primary-600' },
  completed: { label: '已完成', className: 'bg-emerald-50 text-emerald-600' },
  archived: { label: '已归档', className: 'bg-gray-100 text-gray-500' },
};

/** 任务卡片（任务归档列表项） */
export const TaskCard = memo(({ task, active, mergeMode, mergeSelected, onSelect }: TaskCardProps) => {
  const status = STATUS_META[task.status];

  return (
    <button
      onClick={() => onSelect(task.id)}
      className={cn(
        'flex w-full flex-col gap-2 border-b border-surface-divider px-4 py-3.5 text-left transition-colors dark:border-gray-800',
        active ? 'bg-primary-50 dark:bg-primary-950/40' : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.03]',
        mergeMode && mergeSelected && 'bg-violet-50 dark:bg-violet-950/40'
      )}
    >
      <div className="flex items-center gap-2">
        {mergeMode ? (
          <span className={cn('shrink-0', mergeSelected ? 'text-violet-500' : 'text-gray-300')}>
            {mergeSelected ? <CheckCircle2 size={16} /> : <Circle size={16} />}
          </span>
        ) : (
          <span className={cn('h-2 w-2 shrink-0 rounded-full', CATEGORY_STYLES[task.category].dot)} />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink dark:text-gray-100">{task.title}</span>
        <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', status.className)}>{status.label}</span>
      </div>

      <div className="flex items-center justify-between gap-2 pl-4 text-xs text-ink-muted dark:text-gray-500">
        <span className="flex items-center gap-2">
          <span>{CATEGORY_LABELS[task.category]}</span>
          <span>{task.mailCount} 封邮件</span>
          {task.unreadCount > 0 && <span className="text-brand">{task.unreadCount} 未读</span>}
        </span>
        <span className="flex items-center gap-1.5">
          {task.priority === 'high' && (
            <span className={cn('rounded px-1 py-px text-[10px] font-medium', PRIORITY_STYLES.high.badge)}>紧急</span>
          )}
          {task.status === 'archived' && <Archive size={11} />}
          <span>{formatMailTime(task.updatedAt)}</span>
        </span>
      </div>
    </button>
  );
});

TaskCard.displayName = 'TaskCard';
