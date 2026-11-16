import { Mail } from 'lucide-react';
import type { Mail as MailType } from '@/types';
import { isUnread } from '@/types';
import { cn } from '@/utils/cn';
import { formatFullTime } from '@/utils/datetime';
import { previewText } from '@/utils/mailParser';

interface TaskTimelineProps {
  mails: MailType[];
  onOpenMail: (mailId: string) => void;
}

/** 任务邮件时间线（按时间正序展示任务内所有邮件） */
export const TaskTimeline = ({ mails, onOpenMail }: TaskTimelineProps) => {
  const sorted = [...mails].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="relative flex flex-col gap-3 pl-5">
      {/* 时间轴竖线 */}
      <div className="absolute bottom-2 left-[9px] top-2 w-px bg-surface-border dark:bg-gray-700" />

      {sorted.map((mail) => (
        <button
          key={mail.id}
          onClick={() => onOpenMail(mail.id)}
          className="relative rounded-panel bg-white p-3.5 text-left shadow-card transition-shadow hover:shadow-elevated dark:bg-gray-800"
        >
          {/* 时间节点 */}
          <span
            className={cn(
              'absolute -left-5 top-5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-800',
              isUnread(mail) ? 'bg-brand' : 'bg-gray-300 dark:bg-gray-600'
            )}
          />

          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-ink dark:text-gray-100">
              <Mail size={12} className="text-ink-muted" />
              {mail.from.name}
            </span>
            <span className="text-[11px] text-ink-muted dark:text-gray-500">{formatFullTime(mail.date)}</span>
          </div>

          <p className="mb-1 truncate text-sm font-medium text-ink dark:text-gray-200">{mail.subject}</p>
          <p className="text-xs leading-5 text-ink-secondary dark:text-gray-400">
            {mail.summary ? previewText(mail.summary.coreContent, 120) : previewText(mail.bodyText, 120)}
          </p>
        </button>
      ))}
    </div>
  );
};
