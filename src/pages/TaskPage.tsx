import { Archive, Calendar, CheckCircle2, CheckSquare, ChevronLeft, GitMerge, Layers, ListTodo, Mail, RotateCcw, Search, Sparkles, Square } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TaskStatus } from '@/types';
import { useMailStore } from '@/stores/mailStore';
import { useTaskStore } from '@/stores/taskStore';
import { useTodoStore } from '@/stores/todoStore';
import { useCalendarStore } from '@/stores/calendarStore';
import { cn } from '@/utils/cn';
import { TaskCard } from '@/components/task/TaskCard';
import { TaskTimeline } from '@/components/task/TaskTimeline';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/common/Button';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

type StatusFilter = 'all' | TaskStatus;

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'archived', label: '已归档' },
];

/** 任务归档页：任务列表 + 任务详情（时间线 / 合并摘要 / 状态管理） */
export const TaskPage = () => {
  const navigate = useNavigate();
  const tasks = useTaskStore((s) => s.tasks);
  const activeTaskId = useTaskStore((s) => s.activeTaskId);
  const generatingSummaryId = useTaskStore((s) => s.generatingSummaryId);
  const mails = useMailStore((s) => s.mails);
  const todos = useTodoStore((s) => s.todos);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [keyword, setKeyword] = useState('');
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSelection, setMergeSelection] = useState<Set<string>>(new Set());
  const [confirmMerge, setConfirmMerge] = useState(false);

  const filteredTasks = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return tasks.filter((task) => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (kw && !task.title.toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [tasks, statusFilter, keyword]);

  const activeTask = useMemo(() => tasks.find((task) => task.id === activeTaskId) ?? null, [tasks, activeTaskId]);

  const taskMails = useMemo(() => {
    if (!activeTask) return [];
    const byId = new Map(mails.map((mail) => [mail.id, mail]));
    return activeTask.mailIds.map((id) => byId.get(id)).filter((mail): mail is NonNullable<typeof mail> => Boolean(mail));
  }, [activeTask, mails]);

  const taskTodos = useMemo(() => {
    if (!activeTask) return [];
    return todos.filter((todo) => todo.sourceTaskId === activeTask.id);
  }, [activeTask, todos]);

  const handleSelect = (id: string): void => {
    if (mergeMode) {
      setMergeSelection((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      return;
    }
    useTaskStore.getState().setActive(id);
  };

  const handleMerge = async (): Promise<void> => {
    await useTaskStore.getState().mergeTasks([...mergeSelection]);
    setMergeMode(false);
    setMergeSelection(new Set());
    setConfirmMerge(false);
  };

  const handleOpenMail = (mailId: string): void => {
    useMailStore.getState().select(mailId);
    navigate('/');
  };

  /** 切换关联待办的完成状态 */
  const handleToggleTodo = (todoId: string): void => {
    void useTodoStore.getState().toggle(todoId);
  };

  /** 跳转到待办清单并定位该待办 */
  const handleOpenTodo = (todoId: string): void => {
    useTodoStore.getState().setFocus(todoId);
    navigate('/todos');
  };

  /** 跳转到日历并打开待办对应日程 */
  const handleOpenCalendar = (eventId: string): void => {
    if (!useCalendarStore.getState().events.some((event) => event.id === eventId)) return;
    useCalendarStore.getState().setFocusEvent(eventId);
    navigate('/calendar');
  };

  const showDetail = Boolean(activeTask);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 页头 */}
      <header className="flex items-center justify-between border-b border-surface-divider bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
        <h1 className="font-display text-base font-semibold text-ink dark:text-gray-100">任务归档</h1>
        <div className="flex items-center gap-2">
          {mergeMode && mergeSelection.size >= 2 && (
            <Button size="sm" onClick={() => setConfirmMerge(true)}>
              <GitMerge size={13} />
              合并（{mergeSelection.size}）
            </Button>
          )}
          <Button
            variant={mergeMode ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => {
              setMergeMode((v) => !v);
              setMergeSelection(new Set());
            }}
          >
            <GitMerge size={13} />
            {mergeMode ? '退出合并' : '合并任务'}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* 任务列表 */}
        <section
          className={cn(
            'flex w-full flex-col border-r border-surface-divider bg-white md:w-[360px] md:shrink-0 dark:border-gray-800 dark:bg-gray-900',
            showDetail && 'hidden md:flex'
          )}
        >
          <div className="flex flex-col gap-2 border-b border-surface-divider px-3 py-2.5 dark:border-gray-800">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索任务名称…"
                className="input-base pl-8"
              />
            </div>
            <div className="flex items-center gap-1">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs transition-colors',
                    statusFilter === tab.value
                      ? 'bg-black/[0.06] font-medium text-ink dark:bg-white/10 dark:text-gray-100'
                      : 'text-ink-muted hover:bg-black/[0.03] dark:text-gray-400 dark:hover:bg-white/5'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {filteredTasks.length === 0 ? (
              <EmptyState icon={Layers} title="暂无任务" description="同步邮件后，系统会自动将同一主题的邮件归档为任务" />
            ) : (
              filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  active={task.id === activeTaskId}
                  mergeMode={mergeMode}
                  mergeSelected={mergeSelection.has(task.id)}
                  onSelect={handleSelect}
                />
              ))
            )}
          </div>
        </section>

        {/* 任务详情 */}
        <section className={cn('min-w-0 flex-1 overflow-y-auto bg-surface-soft dark:bg-ink-charcoal', !showDetail && 'hidden md:block')}>
          {activeTask ? (
            <div className="flex flex-col gap-4 p-5">
              {/* 任务头 */}
              <div className="rounded-panel bg-white p-4 shadow-card dark:bg-gray-800">
                <div className="mb-1 flex items-center gap-2">
                  <button
                    onClick={() => useTaskStore.getState().setActive(null)}
                    className="rounded-full p-1 text-ink-muted hover:bg-black/5 md:hidden"
                    aria-label="返回列表"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <h2 className="flex-1 font-display text-lg font-medium text-ink dark:text-gray-100">{activeTask.title}</h2>
                </div>
                <p className="mb-3 text-xs text-ink-muted dark:text-gray-500">
                  {activeTask.id} · {activeTask.mailCount} 封邮件 · {activeTask.unreadCount} 未读
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {activeTask.status !== 'completed' && (
                    <Button variant="secondary" size="sm" onClick={() => void useTaskStore.getState().updateStatus(activeTask.id, 'completed')}>
                      <CheckCircle2 size={13} />
                      标记完成
                    </Button>
                  )}
                  {activeTask.status !== 'archived' ? (
                    <Button variant="secondary" size="sm" onClick={() => void useTaskStore.getState().updateStatus(activeTask.id, 'archived')}>
                      <Archive size={13} />
                      归档
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => void useTaskStore.getState().updateStatus(activeTask.id, 'active')}>
                      <RotateCcw size={13} />
                      恢复进行中
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={generatingSummaryId === activeTask.id}
                    onClick={() => void useTaskStore.getState().generateMergedSummary(activeTask.id)}
                  >
                    <Sparkles size={13} />
                    {activeTask.summary ? '重新生成摘要' : '生成合并摘要'}
                  </Button>
                </div>
              </div>

              {/* 合并摘要 */}
              {generatingSummaryId === activeTask.id ? (
                <div className="rounded-panel bg-white shadow-card dark:bg-gray-800">
                  <LoadingSpinner text="AI 正在生成任务合并摘要…" />
                </div>
              ) : (
                activeTask.summary && (
                  <div className="rounded-panel bg-gradient-to-br from-primary-50 via-white to-[#fdf2fb] p-4 shadow-card dark:from-gray-800 dark:via-gray-800 dark:to-gray-800">
                    <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink dark:text-gray-100">
                      <Sparkles size={14} className="text-brand-pink" />
                      任务合并摘要
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-ink dark:text-gray-200">{activeTask.summary}</p>
                  </div>
                )
              )}

              {/* 关联待办 */}
              {taskTodos.length > 0 && (
                <div className="rounded-panel bg-white p-4 shadow-card dark:bg-gray-800">
                  <p className="mb-2 text-xs font-medium text-ink-secondary dark:text-gray-300">
                    关联待办（{taskTodos.filter((t) => !t.completed).length} 未完成 / 共 {taskTodos.length} 项）
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {taskTodos.map((todo) => (
                      <li key={todo.id} className="flex items-center gap-2 text-xs text-ink-secondary dark:text-gray-400">
                        {/* 勾选切换完成状态 */}
                        <button
                          onClick={() => handleToggleTodo(todo.id)}
                          className={cn(
                            'shrink-0 transition-colors',
                            todo.completed ? 'text-emerald-500' : 'text-ink-muted hover:text-primary-500'
                          )}
                          title={todo.completed ? '标记为未完成' : '标记为已完成'}
                        >
                          {todo.completed ? <CheckSquare size={13} /> : <Square size={13} />}
                        </button>
                        <span className={cn(todo.completed && 'line-through opacity-60')}>{todo.content}</span>
                        {/* 跳转到来源邮件 */}
                        {todo.sourceMailId && mails.some((mail) => mail.id === todo.sourceMailId) && (
                          <button
                            onClick={() => todo.sourceMailId && handleOpenMail(todo.sourceMailId)}
                            className="flex shrink-0 items-center gap-0.5 rounded px-1 py-px text-[10px] text-primary-600 transition-colors hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950/40"
                            title="跳转到来源邮件"
                          >
                            <Mail size={11} />
                            邮件
                          </button>
                        )}
                        {/* 跳转到待办清单 */}
                        <button
                          onClick={() => handleOpenTodo(todo.id)}
                          className="flex shrink-0 items-center gap-0.5 rounded px-1 py-px text-[10px] text-primary-600 transition-colors hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950/40"
                          title="跳转到待办清单并定位"
                        >
                          <ListTodo size={11} />
                          待办
                        </button>
                        {/* 跳转到日历日程 */}
                        {todo.calendarEventId && (
                          <button
                            onClick={() => todo.calendarEventId && handleOpenCalendar(todo.calendarEventId)}
                            className="flex shrink-0 items-center gap-0.5 rounded px-1 py-px text-[10px] text-primary-600 transition-colors hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950/40"
                            title="跳转到日历查看日程"
                          >
                            <Calendar size={11} />
                            日历
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 邮件时间线 */}
              <div>
                <p className="mb-3 text-xs font-medium text-ink-muted dark:text-gray-500">邮件时间线</p>
                <TaskTimeline mails={taskMails} onOpenMail={handleOpenMail} />
              </div>
            </div>
          ) : (
            <EmptyState icon={Layers} title="选择一个任务查看详情" description="任务时间线将展示该任务下的所有邮件往来" />
          )}
        </section>
      </div>

      <ConfirmModal
        open={confirmMerge}
        title="合并任务"
        message={`确定将选中的 ${mergeSelection.size} 个任务合并为一个任务吗？合并后原任务将被删除，其邮件全部归入保留任务。`}
        confirmText="合并"
        onConfirm={() => void handleMerge()}
        onCancel={() => setConfirmMerge(false)}
      />
    </div>
  );
};
