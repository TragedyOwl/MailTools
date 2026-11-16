import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** 合并 Tailwind 类名（处理条件类与冲突类） */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
