import { ArrowUpRight, Bell, Mail, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, addHours, format, parseISO } from 'date-fns';
import type { CalendarEvent, EventType } from '@/types';
import { useCalendarStore } from '@/stores/calendarStore';
import { useMailStore } from '@/stores/mailStore';
import { useTodoStore } from '@/stores/todoStore';
import { resolveEventMailId } from '@/services/calendarService';
import { cn } from '@/utils/cn';
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS, REMINDER_LABELS, REMINDER_OPTIONS } from '@/utils/constants';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { ConfirmModal } from '@/components/common/ConfirmModal';

interface EventModalProps {
  /** 预填充的事件（id 已在 store 中存在则视为编辑，否则为新建草稿） */
  event: CalendarEvent;
  onClose: () => void;
}

const EVENT_TYPES: EventType[] = ['meeting', 'deadline', 'reminder', 'other'];

/** 日程创建 / 编辑弹窗 */
export const EventModal = ({ event, onClose }: EventModalProps) => {
  const navigate = useNavigate();
  const exists = useCalendarStore((s) => s.events.some((item) => item.id === event.id));
  const todos = useTodoStore((s) => s.todos);
  const mails = useMailStore((s) => s.mails);

  /** 关联邮件（含经待办回溯），仅当邮件已同步到本地时可跳转 */
  const linkedMail = useMemo(() => {
    const mailId = resolveEventMailId(event, todos);
    if (!mailId) return null;
    return mails.find((mail) => mail.id === mailId) ?? null;
  }, [event, todos, mails]);

  const handleOpenMail = (): void => {
    if (!linkedMail) return;
    // 重置筛选条件，确保目标邮件在列表中可见
    useMailStore.getState().setFilter({ search: '', category: 'all', unreadOnly: false });
    useMailStore.getState().select(linkedMail.id);
    onClose();
    navigate('/');
  };

  const [title, setTitle] = useState(event.title);
  const [type, setType] = useState<EventType>(event.type);
  const [allDay, setAllDay] = useState(event.allDay);
  const [date, setDate] = useState(() => format(parseISO(event.startTime), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState(() => format(parseISO(event.startTime), 'HH:mm'));
  const [endTime, setEndTime] = useState(() => format(parseISO(event.endTime), 'HH:mm'));
  const [reminders, setReminders] = useState<number[]>(event.reminderMinutes);
  const [description, setDescription] = useState(event.description ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleReminder = (minutes: number): void => {
    setReminders((prev) =>
      prev.includes(minutes) ? prev.filter((m) => m !== minutes) : [...prev, minutes].sort((a, b) => a - b)
    );
  };

  const handleSave = async (): Promise<void> => {
    if (saving) return;
    const start = allDay ? new Date(`${date}T00:00:00`) : new Date(`${date}T${startTime}:00`);
    if (Number.isNaN(start.getTime())) return;
    let end = allDay ? addDays(start, 1) : new Date(`${date}T${endTime}:00`);
    if (Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
      end = addHours(start, 1);
    }

    setSaving(true);
    try {
      const patch: Partial<CalendarEvent> = {
        title: title.trim() || '未命名日程',
        type,
        color: EVENT_TYPE_COLORS[type],
        allDay,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        reminderMinutes: reminders,
        description: description.trim() || undefined,
      };
      if (exists) {
        await useCalendarStore.getState().updateEvent(event.id, patch);
      } else {
        await useCalendarStore.getState().addEvent({ ...event, ...patch });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    await useCalendarStore.getState().removeEvent(event.id);
    setConfirmDelete(false);
    onClose();
  };

  return (
    <>
      <Modal open title={exists ? '编辑日程' : '新建日程'} onClose={onClose}>
        <div className="flex flex-col gap-4">
          {/* 标题 */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="日程标题"
            className="input-base"
            autoFocus
          />

          {/* 类型 */}
          <div className="flex flex-wrap items-center gap-1.5">
            {EVENT_TYPES.map((value) => (
              <button
                key={value}
                onClick={() => setType(value)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs transition-colors',
                  type === value
                    ? 'text-white'
                    : 'bg-black/[0.04] text-ink-secondary hover:bg-black/[0.08] dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15'
                )}
                style={type === value ? { backgroundColor: EVENT_TYPE_COLORS[value] } : undefined}
              >
                {EVENT_TYPE_LABELS[value]}
              </button>
            ))}
          </div>

          {/* 日期与全天 */}
          <div className="flex items-center gap-3">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-base flex-1" />
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-ink-secondary dark:text-gray-300">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="h-3.5 w-3.5 accent-primary-500"
              />
              全天
            </label>
          </div>

          {/* 起止时间 */}
          {!allDay && (
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="input-base flex-1"
              />
              <span className="shrink-0 text-xs text-ink-muted dark:text-gray-500">至</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="input-base flex-1"
              />
            </div>
          )}

          {/* 提醒档位 */}
          <div>
            <p className="mb-1.5 flex items-center gap-1 text-xs text-ink-muted dark:text-gray-500">
              <Bell size={11} />
              提醒
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {REMINDER_OPTIONS.map((minutes) => (
                <button
                  key={minutes}
                  onClick={() => toggleReminder(minutes)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs transition-colors',
                    reminders.includes(minutes)
                      ? 'bg-primary-500 text-white'
                      : 'bg-black/[0.04] text-ink-secondary hover:bg-black/[0.08] dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15'
                  )}
                >
                  {REMINDER_LABELS[minutes]}
                </button>
              ))}
            </div>
          </div>

          {/* 备注 */}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="备注（可选）"
            rows={3}
            className="input-base resize-none"
          />

          {/* 关联邮件：快速跳转到来源邮件了解具体内容 */}
          {linkedMail && (
            <button
              type="button"
              onClick={handleOpenMail}
              className="group flex w-full items-center gap-2 rounded-lg border border-surface-border bg-black/[0.02] px-3 py-2 text-left transition-colors hover:border-primary-500/50 hover:bg-primary-50 dark:border-gray-700 dark:bg-white/5 dark:hover:bg-primary-950/30"
              title="跳转到关联邮件"
            >
              <Mail size={14} className="shrink-0 text-primary-500" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-ink dark:text-gray-100">关联邮件</span>
                <span className="block truncate text-[11px] text-ink-muted dark:text-gray-500">{linkedMail.subject}</span>
              </span>
              <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-primary-600 opacity-70 transition-opacity group-hover:opacity-100 dark:text-primary-400">
                查看
                <ArrowUpRight size={12} />
              </span>
            </button>
          )}

          {/* 操作 */}
          <div className="flex items-center justify-between pt-1">
            {exists ? (
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={13} />
                删除
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={onClose}>
                取消
              </Button>
              <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
                {saving ? '保存中…' : '保存'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmDelete}
        title="删除日程"
        message={`确定删除日程「${event.title}」吗？删除后不可恢复。`}
        confirmText="删除"
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
};
