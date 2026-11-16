import { ListTodo, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Priority, Todo } from '@/types';
import { useMailStore } from '@/stores/mailStore';
import { useTodoStore } from '@/stores/todoStore';
import { cn } from '@/utils/cn';
import { PRIORITY_LABELS } from '@/utils/constants';
import { TodoItem } from '@/components/todo/TodoItem';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';

type TodoFilter = 'active' | 'completed' | 'all';

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

const sortTodos = (todos: Todo[]): Todo[] =>
  [...todos].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const pa = PRIORITY_ORDER[a.priority];
    const pb = PRIORITY_ORDER[b.priority];
    if (pa !== pb) return pa - pb;
    const da = a.deadline ?? '9999';
    const db = b.deadline ?? '9999';
    return da.localeCompare(db);
  });

/** 将 Date 转为 datetime-local 输入框所需的本地时间字符串 */
const toLocalInput = (date: Date): string => {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** 默认安排时间：明天 09:00 */
const defaultScheduleTime = (): string => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return toLocalInput(date);
};

/** 待办清单页：手动创建 + AI 提取管理 + 一键加入日历 */
export const TodoPage = () => {
  const navigate = useNavigate();
  const todos = useTodoStore((s) => s.todos);
  const focusTodoId = useTodoStore((s) => s.focusTodoId);
  const mails = useMailStore((s) => s.mails);

  const [filter, setFilter] = useState<TodoFilter>('active');
  const [newContent, setNewContent] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [newDeadline, setNewDeadline] = useState('');
  // 为无截止时间的待办安排时间：当前正在安排的待办 + 选中的时间
  const [schedulingTodo, setSchedulingTodo] = useState<Todo | null>(null);
  const [scheduleTime, setScheduleTime] = useState('');
  // 跳转定位高亮：从邮件摘要跳来时短暂高亮目标待办
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const visibleTodos = useMemo(() => {
    const filtered = todos.filter((todo) => {
      if (filter === 'active') return !todo.completed;
      if (filter === 'completed') return todo.completed;
      return true;
    });
    return sortTodos(filtered);
  }, [todos, filter]);

  const activeCount = todos.filter((todo) => !todo.completed).length;

  // 跳转定位：目标待办不在当前筛选下时切换到「全部」
  useEffect(() => {
    if (!focusTodoId) return;
    const todo = useTodoStore.getState().todos.find((item) => item.id === focusTodoId);
    if (!todo) {
      useTodoStore.getState().setFocus(null);
      return;
    }
    if ((filter === 'active' && todo.completed) || (filter === 'completed' && !todo.completed)) {
      setFilter('all');
    }
  }, [focusTodoId, filter]);

  // 跳转定位：目标渲染后滚动到可视区域并高亮 2.5 秒
  useEffect(() => {
    if (!focusTodoId) return;
    if (!visibleTodos.some((todo) => todo.id === focusTodoId)) return;
    document.getElementById(`todo-${focusTodoId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(focusTodoId);
    useTodoStore.getState().setFocus(null);
    const timer = window.setTimeout(() => setHighlightId(null), 2500);
    return () => window.clearTimeout(timer);
  }, [focusTodoId, visibleTodos]);

  const handleAdd = (): void => {
    const content = newContent.trim();
    if (!content) return;
    void useTodoStore.getState().addTodo({
      content,
      priority: newPriority,
      deadline: newDeadline ? new Date(newDeadline).toISOString() : undefined,
      source: 'manual',
    });
    setNewContent('');
    setNewDeadline('');
  };

  const handleOpenSource = (mailId: string): void => {
    if (!mails.some((mail) => mail.id === mailId)) return;
    useMailStore.getState().select(mailId);
    navigate('/');
  };

  /** 加入日历：有截止时间直接加入；无截止时间则弹窗让用户手动指定 */
  const handleAddToCalendar = (id: string): void => {
    const todo = useTodoStore.getState().todos.find((item) => item.id === id);
    if (!todo) return;
    if (todo.deadline) {
      void useTodoStore.getState().addToCalendar(id);
      return;
    }
    setScheduleTime(defaultScheduleTime());
    setSchedulingTodo(todo);
  };

  /** 确认安排：将选中时间设为截止时间并加入日历 */
  const handleConfirmSchedule = async (): Promise<void> => {
    if (!schedulingTodo || !scheduleTime) return;
    const iso = new Date(scheduleTime).toISOString();
    await useTodoStore.getState().updateTodo(schedulingTodo.id, { deadline: iso });
    await useTodoStore.getState().addToCalendar(schedulingTodo.id);
    setSchedulingTodo(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between border-b border-surface-divider bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
        <h1 className="font-display text-base font-semibold text-ink dark:text-gray-100">
          待办清单
          {activeCount > 0 && <span className="ml-2 text-sm font-normal text-ink-muted">{activeCount} 项待完成</span>}
        </h1>
        <div className="flex items-center gap-1">
          {(['active', 'completed', 'all'] as TodoFilter[]).map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs transition-colors',
                filter === value
                  ? 'bg-black/[0.06] font-medium text-ink dark:bg-white/10 dark:text-gray-100'
                  : 'text-ink-muted hover:bg-black/[0.03] dark:text-gray-400 dark:hover:bg-white/5'
              )}
            >
              {value === 'active' ? '未完成' : value === 'completed' ? '已完成' : '全部'}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 overflow-y-auto p-4 md:p-5">
        {/* 新建待办 */}
        <div className="flex flex-col gap-2 rounded-panel bg-white p-4 shadow-card dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <input
              value={newContent}
              onChange={(event) => setNewContent(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleAdd();
              }}
              placeholder="添加待办事项，回车快速创建…"
              className="input-base flex-1"
            />
            <Button size="sm" onClick={handleAdd} disabled={!newContent.trim()} className="h-9">
              <Plus size={14} />
              添加
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {(['high', 'medium', 'low'] as Priority[]).map((priority) => (
                <button
                  key={priority}
                  onClick={() => setNewPriority(priority)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs transition-colors',
                    newPriority === priority
                      ? priority === 'high'
                        ? 'bg-red-500 text-white'
                        : priority === 'medium'
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-400 text-white'
                      : 'text-ink-muted hover:bg-black/[0.03] dark:text-gray-400 dark:hover:bg-white/5'
                  )}
                >
                  {PRIORITY_LABELS[priority]}
                </button>
              ))}
            </div>
            <input
              type="datetime-local"
              value={newDeadline}
              onChange={(event) => setNewDeadline(event.target.value)}
              className="input-base w-auto flex-1 text-xs"
            />
          </div>
        </div>

        {/* 待办列表 */}
        {visibleTodos.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title={filter === 'completed' ? '还没有已完成的待办' : '暂无待办事项'}
            description="AI 会自动从邮件中提取待办事项，也可以手动创建"
          />
        ) : (
          <div className="flex flex-col gap-2.5 pb-4">
            {visibleTodos.map((todo) => (
              <div key={todo.id} id={`todo-${todo.id}`}>
                <TodoItem
                  todo={todo}
                  highlighted={highlightId === todo.id}
                  onToggle={(id) => void useTodoStore.getState().toggle(id)}
                  onRemove={(id) => void useTodoStore.getState().removeTodo(id)}
                  onAddToCalendar={handleAddToCalendar}
                  onOpenSource={handleOpenSource}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 安排时间弹窗：为无截止时间的待办手动指定时间并加入日历 */}
      <Modal open={schedulingTodo !== null} title="安排时间并加入日历" onClose={() => setSchedulingTodo(null)} widthClassName="max-w-sm">
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-6 text-ink-secondary dark:text-gray-300">
            为「{schedulingTodo?.content}」指定时间，将同时设为截止时间并在日历中呈现。
          </p>
          <input
            type="datetime-local"
            value={scheduleTime}
            onChange={(event) => setScheduleTime(event.target.value)}
            className="input-base"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSchedulingTodo(null)}>
              取消
            </Button>
            <Button size="sm" onClick={() => void handleConfirmSchedule()} disabled={!scheduleTime}>
              加入日历
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
