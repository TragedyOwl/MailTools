import { addDays, addMonths, addWeeks, endOfWeek, format, parseISO, startOfWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Bell, BellRing, CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useEffect, useState } from 'react';
import type { CalendarEvent, CalendarViewMode } from '@/types';
import { useCalendarStore } from '@/stores/calendarStore';
import { useMailStore } from '@/stores/mailStore';
import { useTodoStore } from '@/stores/todoStore';
import { notificationAllowed, requestNotificationPermission } from '@/services/notificationService';
import { resolveEventMailId } from '@/services/calendarService';
import { cn } from '@/utils/cn';
import { EVENT_TYPE_COLORS } from '@/utils/constants';
import { MonthView } from '@/components/calendar/MonthView';
import { TimeGrid } from '@/components/calendar/TimeGrid';
import { EventModal } from '@/components/calendar/EventModal';
import { Button } from '@/components/common/Button';

const VIEW_TABS: Array<{ value: CalendarViewMode; label: string }> = [
  { value: 'month', label: '月' },
  { value: 'week', label: '周' },
  { value: 'day', label: '日' },
];

/** 日历页：月 / 周 / 日视图 + 事件创建编辑 + 浏览器提醒 */
export const CalendarPage = () => {
  const events = useCalendarStore((s) => s.events);
  const viewMode = useCalendarStore((s) => s.viewMode);
  const anchorDate = useCalendarStore((s) => s.anchorDate);
  const focusEventId = useCalendarStore((s) => s.focusEventId);
  const mails = useMailStore((s) => s.mails);
  const todos = useTodoStore((s) => s.todos);

  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [notifyOn, setNotifyOn] = useState(notificationAllowed);

  const anchor = useMemo(() => parseISO(anchorDate), [anchorDate]);

  // 跳转定位：从邮件摘要等处跳来时，锚定到目标日程日期并打开详情
  useEffect(() => {
    if (!focusEventId) return;
    const event = useCalendarStore.getState().events.find((item) => item.id === focusEventId);
    useCalendarStore.getState().setFocusEvent(null);
    if (!event) return;
    useCalendarStore.getState().setAnchorDate(event.startTime);
    setEditingEvent(event);
  }, [focusEventId]);

  /** 已关联本地邮件的事件 ID 集合（视图展示邮件图标） */
  const linkedMailEventIds = useMemo(() => {
    const mailIds = new Set(mails.map((mail) => mail.id));
    const result = new Set<string>();
    for (const event of events) {
      const mailId = resolveEventMailId(event, todos);
      if (mailId && mailIds.has(mailId)) result.add(event.id);
    }
    return result;
  }, [events, mails, todos]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchor]);

  const title = useMemo(() => {
    if (viewMode === 'month') return format(anchor, 'yyyy年M月', { locale: zhCN });
    if (viewMode === 'week') {
      const start = startOfWeek(anchor, { weekStartsOn: 1 });
      const end = endOfWeek(anchor, { weekStartsOn: 1 });
      return `${format(start, 'M月d日')} - ${format(end, 'M月d日')}`;
    }
    return format(anchor, 'yyyy年M月d日 EEEE', { locale: zhCN });
  }, [anchor, viewMode]);

  const handleNavigate = (direction: -1 | 1): void => {
    const next =
      viewMode === 'month' ? addMonths(anchor, direction) : viewMode === 'week' ? addWeeks(anchor, direction) : addDays(anchor, direction);
    useCalendarStore.getState().setAnchorDate(next.toISOString());
  };

  const handleToday = (): void => {
    useCalendarStore.getState().setAnchorDate(new Date().toISOString());
  };

  const handleSelectDay = (day: Date): void => {
    useCalendarStore.getState().setAnchorDate(day.toISOString());
    useCalendarStore.getState().setViewMode('day');
  };

  const handleCreate = (): void => {
    const start = new Date(anchor);
    // 默认锚定日期的下一个整点，持续 1 小时
    const now = new Date();
    start.setHours(now.getHours() + 1, 0, 0, 0);
    setEditingEvent({
      id: `EVT-${crypto.randomUUID()}`,
      title: '',
      description: undefined,
      startTime: start.toISOString(),
      endTime: new Date(start.getTime() + 3600 * 1000).toISOString(),
      allDay: false,
      type: 'other',
      color: EVENT_TYPE_COLORS.other,
      reminderMinutes: [15],
      createdAt: new Date().toISOString(),
    });
  };

  const handleEnableNotify = async (): Promise<void> => {
    const granted = await requestNotificationPermission();
    setNotifyOn(granted);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-gray-900">
      {/* 页头 */}
      <header className="flex items-center justify-between border-b border-surface-divider px-4 py-3 dark:border-gray-800">
        <h1 className="font-display text-base font-semibold text-ink dark:text-gray-100">日历</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void handleEnableNotify()} title="浏览器通知提醒">
            {notifyOn ? <BellRing size={13} className="text-primary-500" /> : <Bell size={13} />}
            {notifyOn ? '提醒已开启' : '开启提醒'}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleCreate}>
            <CalendarPlus size={13} />
            新建日程
          </Button>
        </div>
      </header>

      {/* 工具栏 */}
      <div className="flex items-center justify-between border-b border-surface-divider px-4 py-2 dark:border-gray-800">
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleNavigate(-1)}
            className="rounded-full p-1.5 text-ink-secondary hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10"
            aria-label="上一页"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleToday}
            className="rounded-full px-2.5 py-1 text-xs text-ink-secondary hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10"
          >
            今天
          </button>
          <button
            onClick={() => handleNavigate(1)}
            className="rounded-full p-1.5 text-ink-secondary hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10"
            aria-label="下一页"
          >
            <ChevronRight size={16} />
          </button>
          <h2 className="ml-2 font-display text-sm font-medium text-ink dark:text-gray-100">{title}</h2>
        </div>

        <div className="flex items-center rounded-full bg-black/[0.04] p-0.5 dark:bg-white/10">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => useCalendarStore.getState().setViewMode(tab.value)}
              className={cn(
                'rounded-full px-3 py-1 text-xs transition-colors',
                viewMode === tab.value
                  ? 'bg-white font-medium text-ink shadow-sm dark:bg-gray-700 dark:text-gray-100'
                  : 'text-ink-muted hover:text-ink-secondary dark:text-gray-400'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 视图主体 */}
      <div className="min-h-0 flex-1">
        {viewMode === 'month' ? (
          <MonthView
            anchor={anchor}
            events={events}
            linkedMailEventIds={linkedMailEventIds}
            onSelectDay={handleSelectDay}
            onSelectEvent={setEditingEvent}
          />
        ) : (
          <TimeGrid
            days={viewMode === 'week' ? weekDays : [anchor]}
            events={events}
            linkedMailEventIds={linkedMailEventIds}
            onSelectEvent={setEditingEvent}
          />
        )}
      </div>

      {/* 事件创建 / 编辑弹窗 */}
      {editingEvent && <EventModal key={editingEvent.id} event={editingEvent} onClose={() => setEditingEvent(null)} />}
    </div>
  );
};
