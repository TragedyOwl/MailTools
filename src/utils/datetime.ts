import { format, isSameDay, isSameWeek, isSameYear, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';

/** 邮件列表时间显示：今天→HH:mm，本周→周X，今年→M月d日，其他→yyyy/M/d */
export const formatMailTime = (iso: string): string => {
  try {
    const date = parseISO(iso);
    const now = new Date();
    if (isSameDay(date, now)) return format(date, 'HH:mm');
    if (isSameWeek(date, now, { weekStartsOn: 1 })) return format(date, 'EEEE', { locale: zhCN });
    if (isSameYear(date, now)) return format(date, 'M月d日', { locale: zhCN });
    return format(date, 'yyyy/M/d');
  } catch {
    return '';
  }
};

/** 完整时间显示 */
export const formatFullTime = (iso: string): string => {
  try {
    return format(parseISO(iso), 'yyyy年M月d日 HH:mm', { locale: zhCN });
  } catch {
    return '';
  }
};

/** 日期显示 */
export const formatDate = (iso: string): string => {
  try {
    return format(parseISO(iso), 'yyyy年M月d日 EEEE', { locale: zhCN });
  } catch {
    return '';
  }
};

/** 时间显示 */
export const formatTime = (iso: string): string => {
  try {
    return format(parseISO(iso), 'HH:mm');
  } catch {
    return '';
  }
};

/** 待办截止时间的友好显示与逾期判断 */
export const formatDeadline = (iso: string): { text: string; overdue: boolean } => {
  try {
    const date = parseISO(iso);
    const overdue = date.getTime() < Date.now();
    return { text: format(date, 'M月d日 HH:mm', { locale: zhCN }), overdue };
  } catch {
    return { text: '', overdue: false };
  }
};

/** 同步时间的相对显示 */
export const formatSyncTime = (iso: string | null): string => {
  if (!iso) return '从未同步';
  try {
    const diff = Date.now() - parseISO(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    return format(parseISO(iso), 'M月d日 HH:mm', { locale: zhCN });
  } catch {
    return '';
  }
};
