import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

interface LoadingSpinnerProps {
  text?: string;
  className?: string;
}

/** 加载指示器 */
export const LoadingSpinner = ({ text, className }: LoadingSpinnerProps) => (
  <div className={cn('flex items-center justify-center gap-2 py-8 text-ink-muted dark:text-gray-400', className)}>
    <Loader2 size={18} className="animate-spin" />
    {text && <span className="text-sm">{text}</span>}
  </div>
);
