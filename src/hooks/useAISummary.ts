import { useEffect } from 'react';
import { useMailStore } from '@/stores/mailStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTodoStore } from '@/stores/todoStore';
import { useCalendarStore } from '@/stores/calendarStore';
import { useAiSummaryStatusStore } from '@/stores/aiSummaryStatusStore';
import { summarizeMailStream } from '@/services/aiService';
import { AI_BATCH_SIZE } from '@/utils/constants';

/** 截断主题用于状态条展示 */
const brief = (subject: string, max = 14): string => (subject.length > max ? `${subject.slice(0, max)}…` : subject);

/** 主题是否含会议线索（AI 分类可能未命中 meeting，此处兼容宣贯会/培训会等表述） */
const MEETING_SUBJECT_PATTERN = /会议|例会|研讨|宣贯|培训会|评审会|启动会|meeting/i;

/**
 * 会议时间兜底入历：当邮件分类为会议或主题含会议线索时，
 * 基于正文时间信息自动创建日程（待办无截止时间导致无法入历的场景由此覆盖；
 * 同一邮件已有事件或无时间信息时内部跳过）。
 */
const ensureMeetingEvent = async (mailId: string): Promise<void> => {
  const mail = useMailStore.getState().mails.find((item) => item.id === mailId);
  if (!mail) return;
  if (mail.category !== 'meeting' && !MEETING_SUBJECT_PATTERN.test(mail.subject)) return;
  await useCalendarStore.getState().addEventFromMail(mail);
};

/**
 * AI 摘要队列处理器：
 * 监听邮件 Store 的摘要队列，按批次（5 封/批）并发生成摘要，
 * 成功后更新邮件记录并自动提取待办事项，同时向状态 Store 上报进度/阶段/日志。
 */
export const useAISummary = (): void => {
  const queueLength = useMailStore((s) => s.summaryQueue.length);
  const summarizing = useMailStore((s) => s.summarizing);
  const privacyMode = useSettingsStore((s) => s.privacyMode);

  useEffect(() => {
    if (queueLength === 0 || summarizing) return;

    const mailStore = useMailStore.getState();
    mailStore.setSummarizing(true);

    const process = async (): Promise<void> => {
      const status = useAiSummaryStatusStore.getState();
      status.begin(useMailStore.getState().summaryQueue.length);
      try {
        for (;;) {
          const state = useMailStore.getState();
          const batch = state.summaryQueue.slice(0, AI_BATCH_SIZE);
          if (batch.length === 0) break;

          // 隐私模式：直接使用本地降级摘要，不调用外部 AI
          if (useSettingsStore.getState().privacyMode) {
            status.setStage('隐私模式：使用本地规则生成摘要…');
            for (const id of batch) {
              const mail = state.mails.find((item) => item.id === id);
              if (mail) {
                status.logStart(mail.id, mail.subject);
                status.logSuccess(mail.id, '本地规则摘要（隐私模式）');
              }
            }
            await state.applyLocalSummaries(batch);
            state.dequeueSummaries(batch);
            for (let i = 0; i < batch.length; i++) status.incrementDone();
            continue;
          }

          const mails = batch
            .map((id) => state.mails.find((mail) => mail.id === id))
            .filter((mail): mail is NonNullable<typeof mail> => Boolean(mail));

          const ai = useSettingsStore.getState().getDecryptedAI();
          await Promise.all(
            mails.map(async (mail) => {
              const statusStore = useAiSummaryStatusStore.getState();
              statusStore.logStart(mail.id, mail.subject);
              statusStore.logStage(mail.id, '正在调用 AI…');
              statusStore.setStage(`正在调用 AI 分析「${brief(mail.subject)}」…`);

              // 网络级流式：模型增量输出通过 appendOutput 实时追加到详情面板
              const { summary, category, priority, error, raw, streamed } = await summarizeMailStream(mail, ai, (text) => {
                useAiSummaryStatusStore.getState().appendOutput(mail.id, text);
              });
              // 降级（非流式）时 onDelta 未触发，用 raw 一次性补设输出
              if (!streamed && raw) useAiSummaryStatusStore.getState().logOutput(mail.id, raw);
              await useMailStore.getState().applySummary(mail.id, summary, category, priority);

              // 自动提取待办
              useAiSummaryStatusStore.getState().logStage(mail.id, '正在提取待办…');
              useAiSummaryStatusStore.getState().setStage(`正在提取待办「${brief(mail.subject)}」…`);
              const updated = useMailStore.getState().mails.find((item) => item.id === mail.id);
              if (updated) {
                await useTodoStore.getState().addFromActionItems(updated);
                // 自动将带截止时间的待办插入日历（重复插入由 addToCalendar 内部拦截）
                useAiSummaryStatusStore.getState().logStage(mail.id, '正在加入日历…');
                const pendingEventTodos = useTodoStore
                  .getState()
                  .todos.filter((todo) => todo.sourceMailId === mail.id && todo.deadline && !todo.calendarEventId);
                for (const todo of pendingEventTodos) {
                  await useTodoStore.getState().addToCalendar(todo.id);
                }
                // 兜底：会议类邮件的时间信息未随待办入历时，直接基于邮件正文创建日程
                await ensureMeetingEvent(mail.id);
              }

              // 记录结果：AI 调用失败（降级）记为错误，供详情面板展示与重试
              if (error) {
                useAiSummaryStatusStore.getState().logError(mail.id, error);
              } else {
                useAiSummaryStatusStore.getState().logSuccess(mail.id, '已完成摘要 / 待办 / 日历');
              }
              useAiSummaryStatusStore.getState().incrementDone();
            })
          );

          useMailStore.getState().dequeueSummaries(batch);
        }
      } finally {
        useAiSummaryStatusStore.getState().finish();
        useMailStore.getState().setSummarizing(false);
      }
    };

    void process();
  }, [queueLength, summarizing, privacyMode]);
};
