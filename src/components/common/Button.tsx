import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-ink-charcoal text-white hover:bg-ink dark:bg-primary-600 dark:hover:bg-primary-700',
  secondary: 'bg-[#f0f0f0] text-[#333333] hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600',
  ghost: 'text-ink-secondary hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10',
  danger: 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950 dark:hover:bg-red-900',
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
};

/** 基础按钮（遵循设计规范：主按钮深色圆角 8px） */
export const Button = ({ variant = 'primary', size = 'md', className, children, ...rest }: ButtonProps) => (
  <button
    className={cn(
      'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
      VARIANT_STYLES[variant],
      SIZE_STYLES[size],
      className
    )}
    {...rest}
  >
    {children}
  </button>
);
