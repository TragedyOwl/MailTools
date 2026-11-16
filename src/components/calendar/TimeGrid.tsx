import { format, isToday } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Mail } from 'lucide-react';
import type { CalendarEvent } from '@/types';
import { eventOnDay, layoutDayEvents } from '@/services/calendarService';
import { formatTime } from '@/utils/datetime';
import { cn } from '@/utils/cn';

interface TimeGridProps {
  /** 要展示的日期列（周视图 7 天 / 日视图 1 天） */
  days: Date[];
  events: CalendarEvent[];
  /** 已关联本地邮件的事件 ID 集合（展示邮件图标） */
  linkedMailEventIds: Set<string>;
  onSelectEvent: (event: CalendarEvent) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 48;

/** 周 / 日视图：小时时间轴 + 重叠事件分栏布局 */
export const TimeGrid = ({ days, events, linkedMailEventIds, onSelectEvent }: TimeGridProps) => {
  const hasAllDay = days.some((day) => events.some((event) => event.allDay && eventOnDay(event, day)));

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 日期表头 */}
      <div className="flex border-b border-surface-divider dark:border-gray-800">
        <div className="w-12 shrink-0" />
        {days.map((day) => (
          <div key={day.toISOString()} className="flex min-w-0 flex-1 flex-col items-center py-2">
            <span className="text-[10px] text-ink-muted dark:text-gray-500">{format(day, 'EEE', { locale: zhCN })}</span>
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-sm',
                isToday(day) ? 'bg-primary-500 font-semibold text-white' : 'text-ink dark:text-gray-200'
              )}
            >
              {format(day, 'd')}
            </span>
          </div>
        ))}
      </div>

      {/* 全天事件行 */}
      {hasAllDay && (
        <div className="flex border-b border-surface-divider dark:border-gray-800">
          <div className="flex w-12 shrink-0 items-center justify-center text-[10px] text-ink-muted dark:text-gray-500">
            全天
          </div>
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="flex min-w-0 flex-1 flex-col gap-0.5 border-l border-surface-divider p-0.5 dark:border-gray-800"
            >
              {events
                .filter((event) => event.allDay && eventOnDay(event, day))
                .map((event) => (
                  <button
                    key={event.id}
                    onClick={() => onSelectEvent(event)}
                    className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] leading-4"
                    style={{ backgroundColor: `${event.color}1f`, color: event.color }}
                    title={event.title}
                  >
                    {linkedMailEventIds.has(event.id) && <Mail size={9} className="shrink-0 opacity-80" />}
                    <span className="truncate">{event.title}</span>
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}

      {/* 时间轴主体 */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex">
          {/* 小时标签列 */}
          <div className="w-12 shrink-0">
            {HOURS.map((hour) => (
              <div key={hour} className="relative" style={{ height: HOUR_HEIGHT }}>
                {hour > 0 && (
                  <span className="absolute right-2 top-0 -translate-y-1/2 text-[10px] text-ink-muted dark:text-gray-500">
                    {String(hour).padStart(2, '0')}:00
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* 日期列 */}
          <div className="relative flex flex-1">
            {/* 横向网格线 */}
            <div className="pointer-events-none absolute inset-0">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="border-t border-surface-divider dark:border-gray-800"
                  style={{ height: HOUR_HEIGHT }}
                />
              ))}
            </div>

            {days.map((day) => {
              const dayEvents = events.filter((event) => !event.allDay && eventOnDay(event, day));
              const layouts = layoutDayEvents(dayEvents);

              return (
                <div
                  key={day.toISOString()}
                  className="relative min-w-0 flex-1 border-l border-surface-divider dark:border-gray-800"
                  style={{ height: HOUR_HEIGHT * 24 }}
                >
                  {layouts.map((layout) => (
                    <button
                      key={layout.event.id}
                      onClick={() => onSelectEvent(layout.event)}
                      className="absolute overflow-hidden rounded-md px-1.5 py-0.5 text-left"
                      style={{
                        top: `${layout.top * 100}%`,
                        height: `${layout.height * 100}%`,
                        left: `calc(${(layout.lane / layout.laneCount) * 100}% + 2px)`,
                        width: `calc(${100 / layout.laneCount}% - 4px)`,
                        backgroundColor: `${layout.event.color}26`,
                        borderLeft: `2px solid ${layout.event.color}`,
                      }}
                      title={layout.event.title}
                    >
                      <p
                        className="flex items-center gap-1 text-[10px] font-medium leading-4"
                        style={{ color: layout.event.color }}
                      >
                        {linkedMailEventIds.has(layout.event.id) && <Mail size={9} className="shrink-0 opacity-80" />}
                        <span className="truncate">{layout.event.title}</span>
                      </p>
                      {layout.height > 0.035 && (
                        <p className="truncate text-[9px] leading-3 opacity-70" style={{ color: layout.event.color }}>
                          {formatTime(layout.event.startTime)} - {formatTime(layout.event.endTime)}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
