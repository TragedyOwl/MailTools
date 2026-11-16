import { Calendar, FileEdit, Inbox, Layers, ListTodo, Mail, Moon, Send, Settings, Sun } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { useMailStore } from '@/stores/mailStore';
import { useTodoStore } from '@/stores/todoStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatSyncTime } from '@/utils/datetime';
import { isUnread } from '@/types';
import { FOLDER_DRAFTS, FOLDER_INBOX, FOLDER_SENT, FONT_SCALE_LABELS, FONT_SCALE_LEVELS } from '@/utils/constants';

const NAV_ITEMS = [
  { to: '/', icon: Inbox, label: '收件箱', end: true },
  { to: '/drafts', icon: FileEdit, label: '草稿箱', end: false },
  { to: '/sent', icon: Send, label: '已发送', end: false },
  { to: '/tasks', icon: Layers, label: '任务归档', end: false },
  { to: '/todos', icon: ListTodo, label: '待办清单', end: false },
  { to: '/calendar', icon: Calendar, label: '日历', end: false },
  { to: '/settings', icon: Settings, label: '设置', end: false },
] as const;

/** 左侧导航栏（桌面端） */
export const Sidebar = () => {
  const unreadCount = useMailStore((s) => s.mails.filter((mail) => mail.folder === FOLDER_INBOX && isUnread(mail)).length);
  const draftCount = useMailStore((s) => s.mails.filter((mail) => mail.folder === FOLDER_DRAFTS).length);
  const sentCount = useMailStore((s) => s.mails.filter((mail) => mail.folder === FOLDER_SENT).length);
  const pendingTodos = useTodoStore((s) => s.todos.filter((t) => !t.completed).length);
  const lastSyncAt = useMailStore((s) => s.lastSyncAt);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const fontScale = useSettingsStore((s) => s.fontScale);
  const setFontScale = useSettingsStore((s) => s.setFontScale);

  /** 当前字号档位索引（找不到匹配时回退标准档） */
  const scaleIndex = Math.max(0, FONT_SCALE_LEVELS.indexOf(fontScale as (typeof FONT_SCALE_LEVELS)[number]));

  const handleFontScaleChange = (value: string): void => {
    const index = Number(value);
    const next = FONT_SCALE_LEVELS[index];
    if (next !== undefined) setFontScale(next);
  };

  const badgeFor = (label: string): number => {
    if (label === '收件箱') return unreadCount;
    if (label === '草稿箱') return draftCount;
    if (label === '已发送') return sentCount;
    if (label === '待办清单') return pendingTodos;
    return 0;
  };

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-surface-divider bg-white md:flex dark:border-gray-800 dark:bg-gray-900">
      {/* 品牌区 */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand">
          <Mail size={18} className="text-white" />
        </div>
        <div>
          <p className="font-display text-sm font-semibold text-ink dark:text-gray-100">智能邮件助手</p>
          <p className="text-[10px] text-ink-muted dark:text-gray-500">AI Mail Assistant</p>
        </div>
      </div>

      {/* 导航 */}
      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => {
          const badge = badgeFor(label);
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-black/5 text-ink dark:bg-white/10 dark:text-gray-100'
                    : 'text-ink-secondary hover:bg-black/[0.03] dark:text-gray-400 dark:hover:bg-white/5'
                )
              }
            >
              <Icon size={17} />
              <span className="flex-1">{label}</span>
              {badge > 0 && (
                <span className="rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* 底部状态区 */}
      <div className="flex flex-col gap-2 border-t border-surface-divider px-4 py-3 dark:border-gray-800">
        <p className="text-[11px] text-ink-muted dark:text-gray-500">上次同步：{formatSyncTime(lastSyncAt)}</p>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-ink-secondary transition-colors hover:bg-black/5 dark:text-gray-400 dark:hover:bg-white/10"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          {theme === 'dark' ? '浅色模式' : '深色模式'}
        </button>

        {/* 字号调节（类微信：小 A + 滑块 + 大 A，档位持久化） */}
        <div className="flex flex-col gap-1 px-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] leading-none text-ink-muted dark:text-gray-500">A</span>
            <input
              type="range"
              min={0}
              max={FONT_SCALE_LEVELS.length - 1}
              step={1}
              value={scaleIndex}
              onChange={(e) => handleFontScaleChange(e.target.value)}
              className="h-1 flex-1 cursor-pointer accent-primary-500"
              aria-label="字体大小"
            />
            <span className="text-sm leading-none text-ink-muted dark:text-gray-500">A</span>
          </div>
          <p className="text-center text-[10px] text-ink-muted dark:text-gray-500">
            字体大小：{FONT_SCALE_LABELS[FONT_SCALE_LEVELS[scaleIndex]] ?? '标准'}
          </p>
        </div>
      </div>
    </aside>
  );
};

/** 移动端底部 Tab 导航（底部空间有限，省略任务归档入口） */
export const MobileTabBar = () => {
  const unreadCount = useMailStore((s) => s.mails.filter((mail) => mail.folder === FOLDER_INBOX && isUnread(mail)).length);
  const pendingTodos = useTodoStore((s) => s.todos.filter((t) => !t.completed).length);

  const badgeFor = (label: string): number => {
    if (label === '收件箱') return unreadCount;
    if (label === '待办清单') return pendingTodos;
    return 0;
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-surface-divider bg-white pb-[env(safe-area-inset-bottom)] md:hidden dark:border-gray-800 dark:bg-gray-900">
      {NAV_ITEMS.filter((item) => item.to !== '/tasks').map(({ to, icon: Icon, label, end }) => {
        const badge = badgeFor(label);
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]',
                isActive ? 'text-brand dark:text-primary-400' : 'text-ink-muted dark:text-gray-500'
              )
            }
          >
            <Icon size={19} />
            {label}
            {badge > 0 && (
              <span className="absolute right-[calc(50%-18px)] top-1 rounded-full bg-red-500 px-1 text-[9px] font-semibold leading-3 text-white">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
};
