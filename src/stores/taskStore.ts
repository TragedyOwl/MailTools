import { create } from 'zustand';
import type { Task, TaskStatus } from '@/types';
import { taskRepository } from '@/db/taskRepository';
import { mailRepository } from '@/db/mailRepository';
import { mergeTaskList } from '@/services/taskService';
import { summarizeTask } from '@/services/aiService';
import { AI_MAX_BODY_CHARS } from '@/utils/constants';
import { useSettingsStore } from './settingsStore';

interface TaskState {
  tasks: Task[];
  activeTaskId: string | null;
  generatingSummaryId: string | null;

  initFrom: (tasks: Task[]) => void;
  applyTasks: (tasks: Task[]) => Promise<void>;
  setActive: (id: string | null) => void;
  updateStatus: (id: string, status: TaskStatus) => Promise<void>;
  renameTask: (id: string, title: string) => Promise<void>;
  mergeTasks: (taskIds: string[]) => Promise<void>;
  generateMergedSummary: (id: string) => Promise<void>;
  reset: () => Promise<void>;
}

export const useTaskStore = create<TaskState>()((set, get) => ({
  tasks: [],
  activeTaskId: null,
  generatingSummaryId: null,

  initFrom: (tasks) => set({ tasks }),

  applyTasks: async (tasks) => {
    if (tasks.length === 0) return;
    await taskRepository.bulkPut(tasks);
    const byId = new Map(get().tasks.map((task) => [task.id, task]));
    for (const task of tasks) byId.set(task.id, task);
    const merged = [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    set({ tasks: merged });
  },

  setActive: (id) => set({ activeTaskId: id }),

  updateStatus: async (id, status) => {
    const patch: Partial<Task> = {
      status,
      completedAt: status === 'completed' ? new Date().toISOString() : undefined,
    };
    await taskRepository.update(id, patch);
    set({
      tasks: get().tasks.map((task) => (task.id === id ? { ...task, ...patch } : task)),
    });
  },

  renameTask: async (id, title) => {
    await taskRepository.update(id, { title });
    set({ tasks: get().tasks.map((task) => (task.id === id ? { ...task, title } : task)) });
  },

  mergeTasks: async (taskIds) => {
    const { merged, removedIds } = mergeTaskList(get().tasks, taskIds, new Date().toISOString());
    await taskRepository.put(merged);
    for (const removedId of removedIds) {
      await taskRepository.delete(removedId);
    }
    // 更新邮件归属
    await Promise.all(merged.mailIds.map((mailId) => mailRepository.update(mailId, { taskId: merged.id })));
    set({
      tasks: get()
        .tasks.filter((task) => !removedIds.includes(task.id))
        .map((task) => (task.id === merged.id ? merged : task)),
      activeTaskId: merged.id,
    });
  },

  generateMergedSummary: async (id) => {
    const task = get().tasks.find((item) => item.id === id);
    if (!task || get().generatingSummaryId) return;

    set({ generatingSummaryId: id });
    try {
      const mails = await mailRepository.getAll();
      const taskMails = task.mailIds
        .map((mailId) => mails.find((mail) => mail.id === mailId))
        .filter((mail): mail is NonNullable<typeof mail> => Boolean(mail))
        .sort((a, b) => a.date.localeCompare(b.date));

      const combined = taskMails
        .map((mail, index) => `【邮件${index + 1}】${mail.subject}\n${mail.bodyText.slice(0, 800)}`)
        .join('\n\n')
        .slice(0, AI_MAX_BODY_CHARS);

      const ai = useSettingsStore.getState().getDecryptedAI();
      const summary = await summarizeTask(task.title, combined, ai);
      const finalSummary =
        summary ??
        `该任务共 ${taskMails.length} 封邮件，最新进展：${taskMails[taskMails.length - 1]?.subject ?? ''}（AI 合并摘要生成失败）`;

      await taskRepository.update(id, { summary: finalSummary });
      set({ tasks: get().tasks.map((item) => (item.id === id ? { ...item, summary: finalSummary } : item)) });
    } finally {
      set({ generatingSummaryId: null });
    }
  },

  reset: async () => {
    await taskRepository.clear();
    set({ tasks: [], activeTaskId: null, generatingSummaryId: null });
  },
}));
