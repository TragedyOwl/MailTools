import { format, isSameMonth, isToday } from 'date-fns';
import { Mail } from 'lucide-react';
import type { CalendarEvent } from '@/types';
import { buildMonthGrid, eventOnDay } from '@/services/calendarService';
import { formatTime } from '@/utils/datetime';
import { cn } from '@/utils/cn';

interface MonthViewProps {
  anchor: Date;
  events: CalendarEvent[];
  /** 已关联本地邮件的事件 ID 集合（展示邮件图标） */
  linkedMailEventIds: Set<string>;
  onSelectDay: (day: Date) => void;
  onSelectEvent: (event: CalendarEvent) => void;
}

const WEEK_HEADERS = ['一', '二', '三', '四', '五', '六', '日'];
const MAX_CHIPS = 3;

/** 月视图：固定 6 行 7 列 42 格 */
export const MonthView = ({ anchor, events, linkedMailEventIds, onSelectDay, onSelectEvent }: MonthViewProps) => {
  const days = buildMonthGrid(anchor);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 星期表头 */}
      <div className="grid grid-cols-7 border-b border-surface-divider dark:border-gray-800">
        {WEEK_HEADERS.map((label) => (
          <div key={label} className="py-2 text-center text-xs text-ink-muted dark:text-gray-500">
            周{label}
          </div>
        ))}
      </div>

      {/* 日期网格 */}
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 border-l border-surface-divider dark:border-gray-800">
        {days.map((day) => {
          const dayEvents = events
            .filter((event) => eventOnDay(event, day))
            .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startTime.localeCompare(b.startTime));
          const inMonth = isSameMonth(day, anchor);
          const today = isToday(day);

          return (
            <div
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              className={cn(
                'flex min-h-0 cursor-pointer flex-col gap-0.5 overflow-hidden border-b border-r border-surface-divider p-1 transition-colors hover:bg-black/[0.02] dark:border-gray-800 dark:hover:bg-white/5',
                !inMonth && 'bg-black/[0.015] dark:bg-white/[0.02]'
              )}
            >
              <div className="flex justify-center">
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs',
                    today
                      ? 'bg-primary-500 font-semibold text-white'
                      : inMonth
                        ? 'text-ink dark:text-gray-200'
                        : 'text-ink-muted/60 dark:text-gray-600'
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>

              {dayEvents.slice(0, MAX_CHIPS).map((event) => (
                <button
                  key={event.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEvent(event);
                  }}
                  className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] leading-4"
                  style={{ backgroundColor: `${event.color}1f`, color: event.color }}
                  title={event.title}
                >
                  {!event.allDay && <span className="shrink-0 opacity-70">{formatTime(event.startTime)}</span>}
                  {linkedMailEventIds.has(event.id) && <Mail size={9} className="shrink-0 opacity-80" />}
                  <span className="truncate">{event.title}</span>
                </button>
              ))}

              {dayEvents.length > MAX_CHIPS && (
                <span className="px-1 text-[10px] text-ink-muted dark:text-gray-500">
                  +{dayEvents.length - MAX_CHIPS} 更多
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
