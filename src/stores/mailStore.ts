import { create } from 'zustand';
import type { Mail, MailCategory, MailSummary, Priority } from '@/types';
import { isDraft } from '@/types';
import { mailRepository } from '@/db/mailRepository';
import { rawToMail } from '@/utils/mailParser';
import { fetchOlderMails, syncNewMails } from '@/services/mailService';
import { assignMailsToTasks } from '@/services/taskService';
import { buildLocalSummary } from '@/services/aiService';
import { useSettingsStore } from './settingsStore';
import { useTaskStore } from './taskStore';
import { useContactStore } from './contactStore';

export interface MailFilter {
  search: string;
  category: MailCategory | 'all';
  unreadOnly: boolean;
}

const MAX_SYNC_ROUNDS = 3;

/** 同步进度：fetched 已拉取封数，total 首轮搜索匹配总数（未知时为 null） */
export interface SyncProgress {
  fetched: number;
  total: number | null;
}

/** 最近一次同步结果（用于完成提示） */
export interface SyncResult {
  added: number;
  at: number;
}

interface MailState {
  mails: Mail[];
  selectedMailId: string | null;
  isSyncing: boolean;
  isLoadingOlder: boolean;
  lastSyncAt: string | null;
  syncError: string | null;
  syncProgress: SyncProgress | null;
  lastSyncResult: SyncResult | null;
  hasMoreOld: boolean;
  filter: MailFilter;
  summaryQueue: string[];
  summarizing: boolean;

  initFrom: (mails: Mail[]) => void;
  syncMails: () => Promise<void>;
  /** 重置同步进度（lastUid 归零）并重新拉取，用于修复同步状态异常 */
  resyncAll: () => Promise<void>;
  clearSyncResult: () => void;
  loadOlder: () => Promise<void>;
  select: (id: string | null) => void;
  markAsRead: (id: string) => Promise<void>;
  setFilter: (patch: Partial<MailFilter>) => void;
  applySummary: (id: string, summary: MailSummary, category: MailCategory, priority: Priority) => Promise<void>;
  enqueueSummaries: (ids: string[]) => void;
  dequeueSummaries: (ids: string[]) => void;
  setSummarizing: (value: boolean) => void;
  applyLocalSummaries: (ids: string[]) => Promise<void>;
  /** 重试摘要：清除已有摘要（含本地降级）并重新入队，走 AI 摘要标准流程（摘要→待办→日历） */
  retrySummary: (id: string) => void;
  clearTask: (mailId: string) => Promise<void>;
  /** 保存草稿（新建或覆盖已有草稿） */
  saveDraft: (draft: Mail) => Promise<void>;
  /** 删除邮件（草稿/已发送等本地记录） */
  deleteMail: (id: string) => Promise<void>;
  /** 已发送邮件入库并进入摘要流水线（摘要→待办→日历） */
  recordSentMail: (mail: Mail) => Promise<void>;
  reset: () => Promise<void>;
}

/** 将新邮件入库并执行任务分组 + 摘要入队（同步与翻页共用） */
const ingestMails = async (
  fresh: Mail[],
  get: () => MailState,
  set: (partial: Partial<MailState>) => void
): Promise<void> => {
  if (fresh.length === 0) return;
  const nowIso = new Date().toISOString();

  await mailRepository.bulkPut(fresh);
  const all = [...get().mails, ...fresh].sort((a, b) => b.date.localeCompare(a.date));
  set({ mails: all });

  // 联系人自动建档：新邮件的发件人/收件人/抄送全部入地址簿（供写信补全）
  await useContactStore.getState().recordContacts(
    fresh.flatMap((mail) => [mail.from, ...mail.to, ...(mail.cc ?? [])]),
    nowIso
  );

  // 任务自动归档
  const assignment = assignMailsToTasks(all, useTaskStore.getState().tasks, nowIso);
  await useTaskStore.getState().applyTasks(assignment.touchedTasks);
  if (assignment.mailTaskMap.size > 0) {
    const withTasks = get().mails.map((mail) => {
      const taskId = assignment.mailTaskMap.get(mail.id);
      return taskId ? { ...mail, taskId } : mail;
    });
    set({ mails: withTasks });
    await Promise.all(
      [...assignment.mailTaskMap.entries()].map(([id, taskId]) => mailRepository.update(id, { taskId }))
    );
  }

  // 摘要：隐私模式 → 本地规则；否则进入 AI 队列（草稿不参与摘要）
  const settings = useSettingsStore.getState();
  const ids = fresh.filter((mail) => !isDraft(mail)).map((mail) => mail.id);
  if (settings.privacyMode) {
    await get().applyLocalSummaries(ids);
  } else {
    get().enqueueSummaries(ids);
  }
};

export const useMailStore = create<MailState>()((set, get) => ({
  mails: [],
  selectedMailId: null,
  isSyncing: false,
  isLoadingOlder: false,
  lastSyncAt: null,
  syncError: null,
  syncProgress: null,
  lastSyncResult: null,
  hasMoreOld: true,
  filter: { search: '', category: 'all', unreadOnly: false },
  summaryQueue: [],
  summarizing: false,

  initFrom: (mails) => set({ mails }),

  syncMails: async () => {
    const settings = useSettingsStore.getState();
    const account = settings.getDecryptedAccount();
    if (!account) {
      set({ syncError: '尚未配置邮箱账号，请前往设置页完成配置' });
      return;
    }
    if (get().isSyncing) return;

    set({ isSyncing: true, syncError: null, syncProgress: { fetched: 0, total: null }, lastSyncResult: null });
    try {
      let lastUid = settings.lastUid;
      const nowIso = new Date().toISOString();
      const seen = new Set(get().mails.map((mail) => mail.messageId));
      const fresh: Mail[] = [];
      let fetched = 0;
      let total: number | null = null;

      for (let round = 0; round < MAX_SYNC_ROUNDS; round++) {
        let response = await syncNewMails(account, lastUid, settings.syncRangeDays);
        // 自愈：本地无邮件、服务器有邮件、但增量范围无匹配 → lastUid 异常，归零重试一次
        if (
          round === 0 &&
          response.pending === 0 &&
          response.total > 0 &&
          get().mails.length === 0 &&
          lastUid > 0
        ) {
          lastUid = 0;
          settings.setLastUid(0);
          response = await syncNewMails(account, lastUid, settings.syncRangeDays);
        }
        fetched += response.mails.length;
        if (total === null) total = response.pending;
        set({ syncProgress: { fetched, total } });
        for (const raw of response.mails) {
          const key = raw.messageId || `uid-${raw.uid}`;
          if (seen.has(key)) continue;
          seen.add(key);
          fresh.push(rawToMail(raw, nowIso));
        }
        lastUid = Math.max(lastUid, response.lastUid);
        if (!response.hasMore) break;
      }

      // 先入库成功再推进 lastUid，避免入库失败导致邮件永久丢失
      await ingestMails(fresh, get, set);
      settings.setLastUid(lastUid);
      set({
        lastSyncAt: new Date().toISOString(),
        lastSyncResult: { added: fresh.length, at: Date.now() },
      });
    } catch (err) {
      set({ syncError: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ isSyncing: false, syncProgress: null });
    }
  },

  clearSyncResult: () => set({ lastSyncResult: null }),

  resyncAll: async () => {
    useSettingsStore.getState().setLastUid(0);
    await get().syncMails();
  },

  loadOlder: async () => {
    const settings = useSettingsStore.getState();
    const account = settings.getDecryptedAccount();
    if (!account || get().isLoadingOlder) return;

    const minUid = get().mails.reduce((min, mail) => (mail.uid > 0 && mail.uid < min ? mail.uid : min), Number.MAX_SAFE_INTEGER);
    if (minUid === Number.MAX_SAFE_INTEGER || minUid <= 1) {
      set({ hasMoreOld: false });
      return;
    }

    set({ isLoadingOlder: true });
    try {
      const response = await fetchOlderMails(account, settings.lastUid, minUid);
      const nowIso = new Date().toISOString();
      const seen = new Set(get().mails.map((mail) => mail.messageId));
      const fresh: Mail[] = [];
      for (const raw of response.mails) {
        const key = raw.messageId || `uid-${raw.uid}`;
        if (seen.has(key)) continue;
        seen.add(key);
        fresh.push(rawToMail(raw, nowIso));
      }
      await ingestMails(fresh, get, set);
      set({ hasMoreOld: response.hasMore });
    } catch (err) {
      set({ syncError: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ isLoadingOlder: false });
    }
  },

  select: (id) => set({ selectedMailId: id }),

  markAsRead: async (id) => {
    const mail = get().mails.find((item) => item.id === id);
    if (!mail || mail.flags.includes('\\Seen')) return;
    const flags = [...mail.flags, '\\Seen'];
    set({ mails: get().mails.map((item) => (item.id === id ? { ...item, flags } : item)) });
    await mailRepository.update(id, { flags });
  },

  setFilter: (patch) => set({ filter: { ...get().filter, ...patch } }),

  applySummary: async (id, summary, category, priority) => {
    set({
      mails: get().mails.map((mail) => (mail.id === id ? { ...mail, summary, category, priority } : mail)),
    });
    await mailRepository.update(id, { summary, category, priority });
  },

  enqueueSummaries: (ids) => {
    const queued = new Set(get().summaryQueue);
    const hasSummary = new Set(get().mails.filter((m) => m.summary).map((m) => m.id));
    const pending = ids.filter((id) => !queued.has(id) && !hasSummary.has(id));
    if (pending.length > 0) set({ summaryQueue: [...get().summaryQueue, ...pending] });
  },

  dequeueSummaries: (ids) => {
    const removing = new Set(ids);
    set({ summaryQueue: get().summaryQueue.filter((id) => !removing.has(id)) });
  },

  setSummarizing: (value) => set({ summarizing: value }),

  applyLocalSummaries: async (ids) => {
    const idSet = new Set(ids);
    const targets = get().mails.filter((mail) => idSet.has(mail.id) && !mail.summary);
    for (const mail of targets) {
      await get().applySummary(mail.id, buildLocalSummary(mail), mail.category, mail.priority);
    }
  },

  retrySummary: (id) => {
    if (!get().mails.some((mail) => mail.id === id)) return;
    // 清除已有摘要（含本地降级）：摘要卡片切换为「生成中」状态
    set({ mails: get().mails.map((mail) => (mail.id === id ? { ...mail, summary: undefined } : mail)) });
    // 重新入队（此时无摘要，不会被 enqueueSummaries 的去重逻辑过滤），由 useAISummary 走标准流程
    get().enqueueSummaries([id]);
  },

  clearTask: async (mailId) => {
    set({ mails: get().mails.map((mail) => (mail.id === mailId ? { ...mail, taskId: undefined } : mail)) });
    await mailRepository.update(mailId, { taskId: undefined });
  },

  saveDraft: async (draft) => {
    await mailRepository.bulkPut([draft]);
    const others = get().mails.filter((mail) => mail.id !== draft.id);
    set({ mails: [...others, draft].sort((a, b) => b.date.localeCompare(a.date)) });
  },

  deleteMail: async (id) => {
    await mailRepository.delete(id);
    set({ mails: get().mails.filter((mail) => mail.id !== id) });
    get().dequeueSummaries([id]);
    if (get().selectedMailId === id) set({ selectedMailId: null });
  },

  recordSentMail: async (mail) => {
    await mailRepository.bulkPut([mail]);
    set({ mails: [mail, ...get().mails].sort((a, b) => b.date.localeCompare(a.date)) });
    // 发件后记录收件人/抄送联系人（发件人为自己，一并入册方便日后抄送自己）
    await useContactStore.getState().recordContacts([mail.from, ...mail.to, ...(mail.cc ?? [])]);
    // 与收件相同：进入摘要流水线，自动提取待办并插入日历
    if (useSettingsStore.getState().privacyMode) {
      await get().applyLocalSummaries([mail.id]);
    } else {
      get().enqueueSummaries([mail.id]);
    }
  },

  reset: async () => {
    await mailRepository.clear();
    set({
      mails: [],
      selectedMailId: null,
      lastSyncAt: null,
      syncError: null,
      syncProgress: null,
      lastSyncResult: null,
      hasMoreOld: true,
      summaryQueue: [],
      summarizing: false,
    });
  },
}));
