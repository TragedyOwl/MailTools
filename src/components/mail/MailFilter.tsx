import { Search } from 'lucide-react';
import type { MailCategory } from '@/types';
import { cn } from '@/utils/cn';
import { CATEGORY_LABELS } from '@/utils/constants';
import type { MailFilter as FilterState } from '@/stores/mailStore';

interface MailFilterProps {
  filter: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
}

const CATEGORY_TABS: Array<{ value: MailCategory | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'meeting', label: CATEGORY_LABELS.meeting },
  { value: 'task', label: CATEGORY_LABELS.task },
  { value: 'approval', label: CATEGORY_LABELS.approval },
  { value: 'notification', label: CATEGORY_LABELS.notification },
  { value: 'other', label: CATEGORY_LABELS.other },
];

/** 邮件过滤器：搜索 + 分类胶囊 + 未读开关 */
export const MailFilter = ({ filter, onChange }: MailFilterProps) => (
  <div className="flex flex-col gap-2 border-b border-surface-divider px-3 py-2.5 dark:border-gray-800">
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
      <input
        value={filter.search}
        onChange={(event) => onChange({ search: event.target.value })}
        placeholder="搜索主题 / 发件人…"
        className="input-base pl-8"
      />
    </div>
    <div className="flex items-center gap-1 overflow-x-auto">
      {CATEGORY_TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange({ category: tab.value })}
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-xs transition-colors',
            filter.category === tab.value
              ? 'bg-black/[0.06] font-medium text-ink dark:bg-white/10 dark:text-gray-100'
              : 'text-ink-muted hover:bg-black/[0.03] dark:text-gray-400 dark:hover:bg-white/5'
          )}
        >
          {tab.label}
        </button>
      ))}
      <div className="mx-1 h-4 w-px shrink-0 bg-surface-border dark:bg-gray-700" />
      <button
        onClick={() => onChange({ unreadOnly: !filter.unreadOnly })}
        className={cn(
          'shrink-0 rounded-full px-2.5 py-1 text-xs transition-colors',
          filter.unreadOnly
            ? 'bg-brand font-medium text-white'
            : 'text-ink-muted hover:bg-black/[0.03] dark:text-gray-400 dark:hover:bg-white/5'
        )}
      >
        未读
      </button>
    </div>
  </div>
);
