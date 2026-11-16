import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { cn } from '@/utils/cn';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  widthClassName?: string;
}

/** 通用模态框（ESC 关闭 / 遮罩点击关闭 / 滚动锁定） */
export const Modal = ({ open, title, onClose, children, widthClassName }: ModalProps) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={cn(
          'relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-card bg-white shadow-elevated dark:bg-gray-800',
          widthClassName
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-surface-divider px-5 py-4 dark:border-gray-700">
          <h2 className="font-display text-base font-medium text-ink dark:text-gray-100">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-ink-muted transition-colors hover:bg-black/5 dark:text-gray-400 dark:hover:bg-white/10"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
};
