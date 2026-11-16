import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

/** 空状态占位 */
export const EmptyState = ({ icon: Icon, title, description, action }: EmptyStateProps) => (
  <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 dark:bg-gray-700">
      <Icon size={24} className="text-primary-500 dark:text-primary-300" />
    </div>
    <p className="text-sm font-medium text-ink dark:text-gray-100">{title}</p>
    {description && <p className="max-w-xs text-xs text-ink-muted dark:text-gray-400">{description}</p>}
    {action}
  </div>
);
