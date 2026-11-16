import { Paperclip, Sparkles } from 'lucide-react';
import { memo } from 'react';
import type { Mail } from '@/types';
import { isUnread } from '@/types';
import { cn } from '@/utils/cn';
import { CATEGORY_STYLES, PRIORITY_STYLES, CATEGORY_LABELS } from '@/utils/constants';
import { formatMailTime } from '@/utils/datetime';
import { previewText } from '@/utils/mailParser';

interface MailCardProps {
  mail: Mail;
  selected: boolean;
  onSelect: (id: string) => void;
}

const AVATAR_COLORS = ['bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500', 'bg-cyan-500'];

const avatarColor = (email: string): string => {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = (hash * 31 + email.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

/** 邮件列表卡片（固定高度以适配虚拟滚动） */
export const MailCard = memo(({ mail, selected, onSelect }: MailCardProps) => {
  const unread = isUnread(mail);

  return (
    <button
      onClick={() => onSelect(mail.id)}
      className={cn(
        'flex h-full w-full items-start gap-3 border-b border-surface-divider px-4 py-3 text-left transition-colors dark:border-gray-800',
        selected ? 'bg-primary-50 dark:bg-primary-950/40' : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.03]'
      )}
    >
      {/* 头像 */}
      <div
        className={cn(
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
          avatarColor(mail.from.email)
        )}
      >
        {mail.from.name.slice(0, 1).toUpperCase()}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* 第一行：发件人 + 时间 */}
        <div className="flex items-center justify-between gap-2">
          <span className={cn('truncate text-sm', unread ? 'font-semibold text-ink dark:text-gray-100' : 'text-ink-secondary dark:text-gray-300')}>
            {mail.from.name}
          </span>
          <span className="shrink-0 text-[11px] text-ink-muted dark:text-gray-500">{formatMailTime(mail.date)}</span>
        </div>

        {/* 第二行：主题 */}
        <div className="flex items-center gap-1.5">
          {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />}
          <span className={cn('truncate text-[13px]', unread ? 'font-semibold text-ink dark:text-gray-100' : 'text-ink dark:text-gray-300')}>
            {mail.subject}
          </span>
          {mail.attachments.length > 0 && <Paperclip size={12} className="shrink-0 text-ink-muted" />}
        </div>

        {/* 第三行：摘要预览 + 标签 */}
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1 truncate text-xs text-ink-muted dark:text-gray-500">
            {mail.summary && <Sparkles size={11} className={cn('shrink-0', mail.summary.source === 'ai' ? 'text-brand-pink' : 'text-gray-400')} />}
            {mail.summary ? previewText(mail.summary.coreContent, 60) : previewText(mail.bodyText, 60)}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {mail.priority === 'high' && (
              <span className={cn('rounded px-1 py-px text-[10px] font-medium', PRIORITY_STYLES.high.badge)}>紧急</span>
            )}
            <span className={cn('rounded px-1 py-px text-[10px] font-medium', CATEGORY_STYLES[mail.category].badge)}>
              {CATEGORY_LABELS[mail.category]}
            </span>
          </span>
        </div>
      </div>
    </button>
  );
});

MailCard.displayName = 'MailCard';
