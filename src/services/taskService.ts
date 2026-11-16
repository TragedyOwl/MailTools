import type { Mail, Task } from '@/types';
import { SUBJECT_SIMILARITY_THRESHOLD } from '@/utils/constants';
import { cleanSubject, extractProjectCode, subjectSimilarity } from '@/utils/stringSimilarity';
import { isUnread } from '@/types';

/** 并查集 */
class UnionFind {
  private readonly parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }

  find(index: number): number {
    let root = index;
    while (this.parent[root] !== root) root = this.parent[root];
    // 路径压缩
    let current = index;
    while (this.parent[current] !== root) {
      const next = this.parent[current];
      this.parent[current] = root;
      current = next;
    }
    return root;
  }

  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
}

export interface TaskAssignment {
  /** 新建或发生变更的任务 */
  touchedTasks: Task[];
  /** 需要更新 taskId 的邮件映射 mailId -> taskId */
  mailTaskMap: Map<string, string>;
}

const newTaskId = (): string =>
  `TASK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

/** 由一组关联邮件构建任务统计字段 */
const buildTaskFromGroup = (existing: Task | undefined, groupMails: Mail[], nowIso: string): Task => {
  const sorted = [...groupMails].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];
  const unreadCount = sorted.filter(isUnread).length;

  return {
    id: existing?.id ?? newTaskId(),
    title: existing?.title ?? cleanSubject(first.subject).slice(0, 60) ?? '(未命名任务)',
    status: existing?.status ?? 'active',
    mailIds: sorted.map((m) => m.id),
    summary: existing?.summary,
    category: latest.category,
    priority: latest.priority,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: latest.date,
    completedAt: existing?.completedAt,
    mailCount: sorted.length,
    unreadCount,
  };
};

/**
 * 任务关联算法（优先级从高到低）：
 * 1. In-Reply-To / References 头匹配（引用链）
 * 2. 主题相似度 >= 阈值（Dice 系数，去除 Re:/Fwd: 前缀）
 * 3. 同一发件人 + 相同项目代号（如 [PROJECT-123]）
 * 4. 已有任务归属（用户手动关联的 mail.taskId 保持不变）
 */
export const assignMailsToTasks = (allMails: Mail[], existingTasks: Task[], nowIso: string): TaskAssignment => {
  const mails = [...allMails].sort((a, b) => a.date.localeCompare(b.date));
  const uf = new UnionFind(mails.length);

  // 规则1：引用链
  const messageIdIndex = new Map<string, number>();
  mails.forEach((mail, i) => {
    if (mail.messageId) messageIdIndex.set(mail.messageId, i);
  });
  mails.forEach((mail, i) => {
    const refs = [...(mail.inReplyTo ? [mail.inReplyTo] : []), ...(mail.references ?? [])];
    for (const ref of refs) {
      const target = messageIdIndex.get(ref);
      if (target !== undefined) uf.union(i, target);
    }
  });

  // 规则2：主题相似度（按前缀分桶，避免全量 O(n²)）
  const buckets = new Map<string, number[]>();
  mails.forEach((mail, i) => {
    const key = cleanSubject(mail.subject).slice(0, 4);
    if (!key) return;
    const bucket = buckets.get(key) ?? [];
    bucket.push(i);
    buckets.set(key, bucket);
  });
  for (const bucket of buckets.values()) {
    const limit = bucket.length > 120 ? 120 : bucket.length;
    for (let a = 0; a < limit; a++) {
      for (let b = a + 1; b < limit; b++) {
        if (subjectSimilarity(mails[bucket[a]].subject, mails[bucket[b]].subject) >= SUBJECT_SIMILARITY_THRESHOLD) {
          uf.union(bucket[a], bucket[b]);
        }
      }
    }
  }

  // 规则3：同一发件人 + 相同项目代号
  const senderCodeGroups = new Map<string, number[]>();
  mails.forEach((mail, i) => {
    const code = extractProjectCode(mail.subject);
    if (!code) return;
    const key = `${mail.from.email}|${code}`;
    const group = senderCodeGroups.get(key) ?? [];
    group.push(i);
    senderCodeGroups.set(key, group);
  });
  for (const group of senderCodeGroups.values()) {
    for (let k = 1; k < group.length; k++) uf.union(group[0], group[k]);
  }

  // 分组
  const groups = new Map<number, Mail[]>();
  mails.forEach((mail, i) => {
    const root = uf.find(i);
    const group = groups.get(root) ?? [];
    group.push(mail);
    groups.set(root, group);
  });

  // 组 → 任务（优先复用已有任务）
  const taskById = new Map(existingTasks.map((t) => [t.id, t]));
  const touchedTasks: Task[] = [];
  const mailTaskMap = new Map<string, string>();

  for (const groupMails of groups.values()) {
    // 组内已有任务归属（取覆盖邮件数最多的任务）
    const candidateCounts = new Map<string, number>();
    for (const mail of groupMails) {
      if (mail.taskId && taskById.has(mail.taskId)) {
        candidateCounts.set(mail.taskId, (candidateCounts.get(mail.taskId) ?? 0) + 1);
      }
    }
    let existing: Task | undefined;
    let best = 0;
    for (const [taskId, count] of candidateCounts) {
      if (count > best) {
        best = count;
        existing = taskById.get(taskId);
      }
    }

    const task = buildTaskFromGroup(existing, groupMails, nowIso);

    const changed =
      !existing ||
      existing.mailCount !== task.mailCount ||
      existing.unreadCount !== task.unreadCount ||
      existing.updatedAt !== task.updatedAt ||
      existing.mailIds.join(',') !== task.mailIds.join(',');

    if (changed) {
      touchedTasks.push(task);
      taskById.set(task.id, task);
    }
    for (const mail of groupMails) {
      if (mail.taskId !== task.id) {
        mailTaskMap.set(mail.id, task.id);
      }
    }
  }

  return { touchedTasks, mailTaskMap };
};

/** 合并多个任务为一个（保留邮件数最多的任务作为基底） */
export const mergeTaskList = (tasks: Task[], taskIds: string[], nowIso: string): { merged: Task; removedIds: string[] } => {
  const targets = tasks.filter((t) => taskIds.includes(t.id));
  if (targets.length < 2) {
    throw new Error('至少需要选择两个任务进行合并');
  }
  const base = [...targets].sort((a, b) => b.mailCount - a.mailCount)[0];
  const others = targets.filter((t) => t.id !== base.id);
  const mailIds = [...new Set(targets.flatMap((t) => t.mailIds))];

  const merged: Task = {
    ...base,
    mailIds,
    mailCount: mailIds.length,
    unreadCount: targets.reduce((sum, t) => sum + t.unreadCount, 0),
    summary: undefined,
    updatedAt: nowIso,
  };
  return { merged, removedIds: others.map((t) => t.id) };
};
