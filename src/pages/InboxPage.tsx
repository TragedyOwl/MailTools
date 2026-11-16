import {
  AlertCircle,
  CheckCircle2,
  Inbox as InboxIcon,
  MailOpen,
  PenSquare,
  RefreshCw,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CalendarEvent, Mail } from '@/types';
import { isUnread } from '@/types';
import { useMailStore } from '@/stores/mailStore';
import { useTaskStore } from '@/stores/taskStore';
import { useTodoStore } from '@/stores/todoStore';
import { useCalendarStore } from '@/stores/calendarStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { createEventFromMail } from '@/services/calendarService';
import { fetchAttachment } from '@/services/mailService';
import type { ComposeDraft } from '@/utils/composeUtils';
import { createEmptyDraft, createForwardDraft, createReplyDraft, draftFromMail } from '@/utils/composeUtils';
import { EVENT_TYPE_COLORS, FOLDER_DRAFTS, FOLDER_INBOX, FOLDER_SENT } from '@/utils/constants';
import { enrichDeadlineTime } from '@/utils/dateExtractor';
import { cn } from '@/utils/cn';
import { MailList } from '@/components/mail/MailList';
import { MailFilter } from '@/components/mail/MailFilter';
import { MailDetail } from '@/components/mail/MailDetail';
import { ComposeModal } from '@/components/mail/ComposeModal';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/common/Button';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { EventModal } from '@/components/calendar/EventModal';

const FOLDER_TITLES: Record<string, string> = {
  [FOLDER_INBOX]: '收件箱',
  [FOLDER_DRAFTS]: '草稿箱',
  [FOLDER_SENT]: '已发送',
};

interface InboxPageProps {
  /** 邮件文件夹：INBOX / DRAFTS / SENT */
  folder?: string;
}

/** 邮件页：左侧列表（虚拟滚动）+ 右侧详情，按文件夹展示收件箱 / 草稿箱 / 已发送 */
export const InboxPage = ({ folder = FOLDER_INBOX }: InboxPageProps) => {
  const navigate = useNavigate();
  const mails = useMailStore((s) => s.mails);
  const filter = useMailStore((s) => s.filter);
  const selectedMailId = useMailStore((s) => s.selectedMailId);
  const isSyncing = useMailStore((s) => s.isSyncing);
  const syncError = useMailStore((s) => s.syncError);
  const syncProgress = useMailStore((s) => s.syncProgress);
  const lastSyncResult = useMailStore((s) => s.lastSyncResult);
  const hasMoreOld = useMailStore((s) => s.hasMoreOld);
  const isLoadingOlder = useMailStore((s) => s.isLoadingOlder);
  const hasAccount = useSettingsStore((s) => s.mailAccount !== null);
  const syncRangeDays = useSettingsStore((s) => s.syncRangeDays);
  const setSyncRangeDays = useSettingsStore((s) => s.setSyncRangeDays);
  const tasks = useTaskStore((s) => s.tasks);
  const todos = useTodoStore((s) => s.todos);

  const [eventDraft, setEventDraft] = useState<CalendarEvent | null>(null);
  const [composeDraft, setComposeDraft] = useState<ComposeDraft | null>(null);
  const [deletingMailId, setDeletingMailId] = useState<string | null>(null);
  const [downloadingAttachment, setDownloadingAttachment] = useState<number | null>(null);

  const isInbox = folder === FOLDER_INBOX;

  const filteredMails = useMemo(() => {
    const keyword = filter.search.trim().toLowerCase();
    return mails.filter((mail) => {
      if (mail.folder !== folder) return false;
      if (filter.category !== 'all' && mail.category !== filter.category) return false;
      if (filter.unreadOnly && !isUnread(mail)) return false;
      if (keyword && !`${mail.subject} ${mail.from.name} ${mail.from.email}`.toLowerCase().includes(keyword)) return false;
      return true;
    });
  }, [mails, filter, folder]);

  const selectedMail = useMemo(
    () => mails.find((mail) => mail.id === selectedMailId) ?? null,
    [mails, selectedMailId]
  );

  const selectedTask = selectedMail?.taskId ? tasks.find((task) => task.id === selectedMail.taskId) : undefined;

  /** 当前选中邮件已关联的待办（摘要卡片内勾选/跳转） */
  const mailTodos = useMemo(() => {
    if (!selectedMail) return [];
    return todos.filter((todo) => todo.sourceMailId === selectedMail.id);
  }, [todos, selectedMail]);

  // 打开邮件时标记已读
  useEffect(() => {
    if (selectedMailId && selectedMail && isUnread(selectedMail)) {
      void useMailStore.getState().markAsRead(selectedMailId);
    }
  }, [selectedMailId, selectedMail]);

  // 切换文件夹时，若选中邮件不属于当前文件夹则取消选中
  useEffect(() => {
    const store = useMailStore.getState();
    const selected = store.mails.find((mail) => mail.id === store.selectedMailId);
    if (selected && selected.folder !== folder) store.select(null);
  }, [folder]);

  // 同步完成提示 4 秒后自动消失
  useEffect(() => {
    if (!lastSyncResult) return;
    const timer = window.setTimeout(() => useMailStore.getState().clearSyncResult(), 4000);
    return () => window.clearTimeout(timer);
  }, [lastSyncResult]);

  const handleSelect = (id: string): void => {
    useMailStore.getState().select(id);
  };

  const handleSync = (): void => {
    void useMailStore.getState().syncMails();
  };

  const handleCreateTodo = (content: string, deadline?: string): void => {
    if (!selectedMail) return;
    // AI 常只返回日期：从邮件正文中回填具体时刻（如 10:40）
    const contextText = [
      selectedMail.subject,
      selectedMail.bodyText,
      ...(selectedMail.summary?.keyPoints ?? []),
      selectedMail.summary?.coreContent ?? '',
    ].join('\n');
    void useTodoStore.getState().addTodo({
      content,
      priority: selectedMail.priority,
      deadline: deadline ? enrichDeadlineTime(deadline, contextText) : undefined,
      sourceMailId: selectedMail.id,
      sourceTaskId: selectedMail.taskId,
      source: 'manual',
    });
  };

  const handleCreateEvent = (mail: Mail): void => {
    const event =
      createEventFromMail(mail) ??
      ({
        id: crypto.randomUUID(),
        title: mail.subject,
        description: mail.summary?.coreContent,
        startTime: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        endTime: new Date(Date.now() + 25 * 3600 * 1000).toISOString(),
        allDay: false,
        type: 'reminder',
        color: EVENT_TYPE_COLORS.reminder,
        sourceMailId: mail.id,
        reminderMinutes: [15],
        createdAt: new Date().toISOString(),
      } satisfies CalendarEvent);
    setEventDraft(event);
  };

  const handleOpenTask = (taskId: string): void => {
    useTaskStore.getState().setActive(taskId);
    navigate('/tasks');
  };

  /** 切换摘要待办的完成状态 */
  const handleToggleTodo = (todoId: string): void => {
    void useTodoStore.getState().toggle(todoId);
  };

  /** 跳转到待办清单并定位该待办 */
  const handleOpenTodo = (todoId: string): void => {
    useTodoStore.getState().setFocus(todoId);
    navigate('/todos');
  };

  /** 跳转到日历并打开对应日程 */
  const handleOpenCalendar = (eventId: string): void => {
    if (!useCalendarStore.getState().events.some((event) => event.id === eventId)) return;
    useCalendarStore.getState().setFocusEvent(eventId);
    navigate('/calendar');
  };

  const handleCompose = (): void => {
    setComposeDraft(createEmptyDraft());
  };

  const handleReply = (mail: Mail): void => {
    setComposeDraft(createReplyDraft(mail));
  };

  const handleForward = (mail: Mail): void => {
    setComposeDraft(createForwardDraft(mail));
  };

  const handleEditDraft = (mail: Mail): void => {
    setComposeDraft(draftFromMail(mail));
  };

  const handleDeleteMail = async (): Promise<void> => {
    if (!deletingMailId) return;
    await useMailStore.getState().deleteMail(deletingMailId);
    setDeletingMailId(null);
  };

  /** 下载附件：按需从 IMAP 拉取 base64 内容，转为 Blob 触发浏览器下载 */
  const handleDownloadAttachment = async (index: number): Promise<void> => {
    if (!selectedMail || downloadingAttachment !== null) return;
    const account = useSettingsStore.getState().getDecryptedAccount();
    if (!account) return;
    setDownloadingAttachment(index);
    try {
      const response = await fetchAttachment(account, selectedMail.uid, index);
      if (!response.ok || !response.contentBase64) throw new Error(response.error ?? '下载失败');
      const bytes = Uint8Array.from(atob(response.contentBase64), (ch) => ch.charCodeAt(0));
      const blob = new Blob([bytes], { type: response.contentType ?? 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = response.filename ?? selectedMail.attachments[index]?.filename ?? 'attachment';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      window.alert(`附件下载失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDownloadingAttachment(null);
    }
  };

  const showDetail = Boolean(selectedMail);

  /** 当前文件夹是否为空（未叠加筛选条件） */
  const folderEmpty = !mails.some((mail) => mail.folder === folder);

  const emptyTitle = folderEmpty
    ? isInbox
      ? '还没有邮件'
      : folder === FOLDER_DRAFTS
        ? '草稿箱是空的'
        : '还没有已发送邮件'
    : '没有符合条件的邮件';

  const emptyDescription = folderEmpty
    ? isInbox
      ? hasAccount
        ? '点击右上角「同步邮件」拉取最新邮件'
        : '请先在设置页完成邮箱配置'
      : folder === FOLDER_DRAFTS
        ? '写邮件时可随时「存草稿」，之后继续编辑并发送'
        : '发送成功的邮件会保存在这里，并自动生成摘要、待办与日历事件'
    : '尝试调整搜索关键词或筛选条件';

  // 同步进度百分比：总量未知时展示不定态
  const progressPercent = syncProgress?.total
    ? Math.min(100, Math.round((syncProgress.fetched / syncProgress.total) * 100))
    : 15;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 页头 */}
      <header className="flex items-center justify-between border-b border-surface-divider bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
        <h1 className="font-display text-base font-semibold text-ink dark:text-gray-100">{FOLDER_TITLES[folder] ?? '收件箱'}</h1>
        <div className="flex items-center gap-2">
          {isInbox && (
            <select
              value={syncRangeDays}
              onChange={(event) => setSyncRangeDays(Number(event.target.value))}
              disabled={isSyncing}
              title="同步时间范围（默认仅同步最近 1 天）"
              className="h-8 rounded-lg border border-surface-border bg-white px-2 text-xs text-ink-secondary outline-none transition-colors focus:border-primary-500 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value={1}>最近 1 天</option>
              <option value={3}>最近 3 天</option>
              <option value={7}>最近 7 天</option>
              <option value={30}>最近 30 天</option>
              <option value={0}>全部邮件</option>
            </select>
          )}
          {isInbox && (
            <Button variant="secondary" size="sm" onClick={handleSync} disabled={isSyncing || !hasAccount}>
              <RefreshCw size={13} className={cn(isSyncing && 'animate-spin')} />
              {isSyncing ? '同步中…' : '同步邮件'}
            </Button>
          )}
          <Button size="sm" onClick={handleCompose}>
            <PenSquare size={13} />
            写邮件
          </Button>
        </div>
      </header>

      {/* 同步进度条 */}
      {isInbox && isSyncing && (
        <div className="border-b border-surface-divider bg-primary-50/60 px-4 py-2.5 dark:border-gray-800 dark:bg-primary-950/30">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-secondary dark:text-gray-400">
              {syncProgress?.total
                ? `正在同步邮件，已获取 ${syncProgress.fetched} / ${syncProgress.total} 封…`
                : '正在连接邮箱服务器…'}
            </span>
            {syncProgress?.total ? (
              <span className="font-data text-primary-600 dark:text-primary-400">{progressPercent}%</span>
            ) : null}
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-primary-100 dark:bg-primary-900/50">
            <div
              className={cn(
                'h-full rounded-full bg-primary-500 transition-all duration-300',
                !syncProgress?.total && 'animate-pulse'
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* 同步失败提示（带重试） */}
      {isInbox && syncError && !isSyncing && (
        <div className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-4 py-2.5 dark:border-red-900/40 dark:bg-red-950/30">
          <AlertCircle size={14} className="shrink-0 text-red-500" />
          <p className="min-w-0 flex-1 truncate text-xs text-red-600 dark:text-red-400" title={syncError}>
            同步失败：{syncError}
          </p>
          <button
            type="button"
            onClick={handleSync}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/40"
          >
            重试
          </button>
        </div>
      )}

      {/* 同步完成提示 */}
      {isInbox && lastSyncResult && !isSyncing && (
        <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50 px-4 py-2 dark:border-emerald-900/40 dark:bg-emerald-950/30">
          <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            {lastSyncResult.added > 0 ? `同步完成，新增 ${lastSyncResult.added} 封邮件` : '同步完成，没有新邮件'}
          </p>
        </div>
      )}

      {/* 主体 */}
      <div className="flex min-h-0 flex-1">
        {/* 列表栏 */}
        <section
          className={cn(
            'flex w-full flex-col border-r border-surface-divider bg-white md:w-[380px] md:shrink-0 dark:border-gray-800 dark:bg-gray-900',
            showDetail && 'hidden md:flex'
          )}
        >
          <MailFilter filter={filter} onChange={(patch) => useMailStore.getState().setFilter(patch)} />
          <div className="min-h-0 flex-1">
            {filteredMails.length === 0 ? (
              <EmptyState
                icon={InboxIcon}
                title={emptyTitle}
                description={emptyDescription}
                action={
                  isInbox && folderEmpty ? (
                    hasAccount ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void useMailStore.getState().resyncAll()}
                        disabled={isSyncing}
                      >
                        <RefreshCw size={13} />
                        重新同步（重置进度）
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => navigate('/settings')}>
                        <SettingsIcon size={13} />
                        前往设置
                      </Button>
                    )
                  ) : undefined
                }
              />
            ) : (
              <MailList
                mails={filteredMails}
                selectedId={selectedMailId}
                onSelect={handleSelect}
                hasMoreOld={isInbox && hasMoreOld && filter.category === 'all' && !filter.search && !filter.unreadOnly}
                isLoadingOlder={isLoadingOlder}
                onLoadOlder={() => void useMailStore.getState().loadOlder()}
              />
            )}
          </div>
        </section>

        {/* 详情栏 */}
        <section className={cn('min-w-0 flex-1 bg-surface-soft dark:bg-ink-charcoal', !showDetail && 'hidden md:block')}>
          {selectedMail ? (
            <MailDetail
              mail={selectedMail}
              taskTitle={selectedTask?.title}
              mailTodos={mailTodos}
              onBack={() => useMailStore.getState().select(null)}
              onCreateTodo={handleCreateTodo}
              onToggleTodo={handleToggleTodo}
              onOpenTodo={handleOpenTodo}
              onOpenCalendar={handleOpenCalendar}
              onCreateEvent={handleCreateEvent}
              onOpenTask={handleOpenTask}
              onRetrySummary={(id) => useMailStore.getState().retrySummary(id)}
              onReply={isInbox ? handleReply : undefined}
              onForward={isInbox || folder === FOLDER_SENT ? handleForward : undefined}
              onEditDraft={folder === FOLDER_DRAFTS ? handleEditDraft : undefined}
              onDelete={!isInbox ? (id) => setDeletingMailId(id) : undefined}
              onDownloadAttachment={isInbox && selectedMail.uid > 0 && hasAccount ? (index) => void handleDownloadAttachment(index) : undefined}
              downloadingAttachment={downloadingAttachment}
            />
          ) : (
            <EmptyState icon={MailOpen} title="选择一封邮件查看详情" description="AI 将为你生成标准化摘要，30 秒掌握邮件要点" />
          )}
        </section>
      </div>

      {/* 事件创建弹窗（从邮件预填充） */}
      {eventDraft && <EventModal event={eventDraft} onClose={() => setEventDraft(null)} />}

      {/* 写信弹窗（新写 / 回复 / 转发 / 编辑草稿） */}
      {composeDraft && <ComposeModal key={composeDraft.id} draft={composeDraft} onClose={() => setComposeDraft(null)} />}

      {/* 删除确认（草稿 / 已发送） */}
      <ConfirmModal
        open={deletingMailId !== null}
        title="删除邮件"
        message="确定删除这封邮件吗？删除后不可恢复。"
        confirmText="删除"
        onConfirm={() => void handleDeleteMail()}
        onCancel={() => setDeletingMailId(null)}
      />
    </div>
  );
};
