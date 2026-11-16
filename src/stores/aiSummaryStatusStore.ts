import { create } from 'zustand';

/** 单封邮件的摘要处理状态 */
export type AiSummaryLogStatus = 'running' | 'success' | 'error';

/** 摘要执行日志条目（详情面板逐条展示） */
export interface AiSummaryLog {
  id: string;
  mailId: string;
  subject: string;
  status: AiSummaryLogStatus;
  /** 当前 / 最后所处阶段 */
  stage: string;
  /** 失败时的错误信息 */
  error?: string;
  /** 模型原始返回内容（含思考过程），供详情面板打字机逐字展示 */
  output?: string;
  at: string;
}

/** 日志清单最大保留条数 */
const MAX_LOGS = 50;

interface AiSummaryStatusState {
  /** 是否正在处理摘要批次 */
  active: boolean;
  /** 状态条滚动展示的当前阶段文字 */
  stageText: string;
  /** 本轮已完成封数 */
  done: number;
  /** 本轮计划处理总数 */
  total: number;
  /** 执行日志清单（最新在前） */
  logs: AiSummaryLog[];
  /** 详情面板是否展开 */
  expanded: boolean;

  begin: (total: number) => void;
  setStage: (text: string) => void;
  logStart: (mailId: string, subject: string) => void;
  logStage: (mailId: string, stage: string) => void;
  logOutput: (mailId: string, output: string) => void;
  appendOutput: (mailId: string, text: string) => void;
  logSuccess: (mailId: string, stage?: string) => void;
  logError: (mailId: string, error: string) => void;
  incrementDone: () => void;
  finish: () => void;
  setExpanded: (value: boolean) => void;
  clearLogs: () => void;
}

/** 更新指定邮件最新一条日志（logStart 始终插入最前，故匹配第一条） */
const patchLatest = (logs: AiSummaryLog[], mailId: string, patch: Partial<AiSummaryLog>): AiSummaryLog[] => {
  let patched = false;
  return logs.map((log) => {
    if (!patched && log.mailId === mailId) {
      patched = true;
      return { ...log, ...patch };
    }
    return log;
  });
};

/**
 * AI 摘要全局状态：
 * 记录摘要队列的处理进度、当前阶段（供状态条文字滚动）、逐封执行日志（供详情面板与失败重试）。
 */
export const useAiSummaryStatusStore = create<AiSummaryStatusState>()((set, get) => ({
  active: false,
  stageText: '',
  done: 0,
  total: 0,
  logs: [],
  expanded: false,

  begin: (total) => set({ active: true, total, done: 0, stageText: '准备生成摘要…' }),

  setStage: (text) => set({ stageText: text }),

  logStart: (mailId, subject) => {
    const entry: AiSummaryLog = {
      id: crypto.randomUUID(),
      mailId,
      subject,
      status: 'running',
      stage: '排队中…',
      at: new Date().toISOString(),
    };
    set({ logs: [entry, ...get().logs].slice(0, MAX_LOGS) });
  },

  logStage: (mailId, stage) => set({ logs: patchLatest(get().logs, mailId, { stage }) }),

  logOutput: (mailId, output) => set({ logs: patchLatest(get().logs, mailId, { output }) }),

  appendOutput: (mailId, text) => {
    let patched = false;
    set({
      logs: get().logs.map((log) => {
        if (!patched && log.mailId === mailId) {
          patched = true;
          return { ...log, output: (log.output ?? '') + text };
        }
        return log;
      }),
    });
  },

  logSuccess: (mailId, stage) =>
    set({ logs: patchLatest(get().logs, mailId, { status: 'success', stage: stage ?? '已完成', error: undefined }) }),

  logError: (mailId, error) =>
    set({ logs: patchLatest(get().logs, mailId, { status: 'error', stage: '生成失败', error }) }),

  incrementDone: () => set({ done: get().done + 1 }),

  finish: () => set({ active: false, stageText: '摘要处理完成' }),

  setExpanded: (value) => set({ expanded: value }),

  clearLogs: () => set({ logs: [] }),
}));
