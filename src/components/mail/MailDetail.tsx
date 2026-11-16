import { CalendarPlus, ChevronLeft, CornerUpLeft, Download, FileText, Forward, Layers, Loader2, Paperclip, PencilLine, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Mail, MailAddress, Todo } from '@/types';
import { cn } from '@/utils/cn';
import { formatFullTime } from '@/utils/datetime';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { MailSummaryCard } from './MailSummary';
import { useSettingsStore } from '@/stores/settingsStore';
import { wrapMailHtml } from '@/utils/htmlText';
import { CATEGORY_LABELS, CATEGORY_STYLES } from '@/utils/constants';

interface MailDetailProps {
  mail: Mail;
  taskTitle?: string;
  /** 该邮件已关联的待办（摘要卡片内展示勾选/跳转） */
  mailTodos?: Todo[];
  onBack?: () => void;
  onCreateTodo: (content: string, deadline?: string) => void;
  /** 切换关联待办的完成状态 */
  onToggleTodo?: (todoId: string) => void;
  /** 跳转到待办清单并定位 */
  onOpenTodo?: (todoId: string) => void;
  /** 跳转到日历并定位待办对应日程 */
  onOpenCalendar?: (eventId: string) => void;
  onCreateEvent: (mail: Mail) => void;
  onOpenTask?: (taskId: string) => void;
  onRetrySummary?: (mailId: string) => void;
  onReply?: (mail: Mail) => void;
  onForward?: (mail: Mail) => void;
  onEditDraft?: (mail: Mail) => void;
  onDelete?: (mailId: string) => void;
  /** 下载附件（仅同步过的收件箱邮件提供） */
  onDownloadAttachment?: (index: number) => void;
  /** 正在下载的附件序号（其余按钮禁用） */
  downloadingAttachment?: number | null;
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
};

interface AddressRowProps {
  label: string;
  addresses: MailAddress[];
}

/** 地址行：标签 + 姓名<邮箱> 列表（多人以顿号分隔，悬停显示完整邮箱） */
const AddressRow = ({ label, addresses }: AddressRowProps) => (
  <div className="flex items-start gap-2">
    <span className="w-12 shrink-0 text-right text-ink-muted dark:text-gray-500">{label}</span>
    <span className="flex min-w-0 flex-wrap items-center gap-y-0.5">
      {addresses.map((addr, index) => (
        <span key={`${addr.email}-${index}`} className="max-w-full truncate" title={addr.email}>
          {addr.name || addr.email}
          <span className="text-ink-muted">&nbsp;&lt;{addr.email}&gt;</span>
          {index < addresses.length - 1 && '、'}
        </span>
      ))}
    </span>
  </div>
);

/** 邮件详情：头部信息 + AI摘要 + 正文 + 附件 */
export const MailDetail = ({
  mail,
  taskTitle,
  mailTodos,
  onBack,
  onCreateTodo,
  onToggleTodo,
  onOpenTodo,
  onOpenCalendar,
  onCreateEvent,
  onOpenTask,
  onRetrySummary,
  onReply,
  onForward,
  onEditDraft,
  onDelete,
  onDownloadAttachment,
  downloadingAttachment,
}: MailDetailProps) => {
  // 默认 HTML 视图；无 HTML 正文时渲染逻辑会自动回退纯文本
  const [showHtml, setShowHtml] = useState(true);
  const theme = useSettingsStore((s) => s.theme);
  const fontScale = useSettingsStore((s) => s.fontScale);

  /** iframe 正文文档：随主题/字号重新生成，深色模式下覆盖邮件自带的白底黑字 */
  const bodySrcDoc = useMemo(() => {
    if (!mail.bodyHtml) return '';
    const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
    return wrapMailHtml(mail.bodyHtml, { dark: theme === 'dark', rootFontSize: 14 * scale });
  }, [mail.bodyHtml, theme, fontScale]);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* 头部 */}
      <div className="border-b border-surface-divider px-5 py-4 dark:border-gray-800">
        <div className="mb-2 flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="rounded-full p-1 text-ink-muted hover:bg-black/5 md:hidden" aria-label="返回列表">
              <ChevronLeft size={18} />
            </button>
          )}
          <h1 className="flex-1 font-display text-lg font-medium leading-6 text-ink dark:text-gray-100">{mail.subject}</h1>
        </div>

        <div className="mb-3 flex flex-col gap-1 text-xs text-ink-secondary dark:text-gray-400">
          <div className="flex items-center gap-x-4 gap-y-1">
            <span className="text-ink-muted">{formatFullTime(mail.date)}</span>
            <Badge className={CATEGORY_STYLES[mail.category].badge}>{CATEGORY_LABELS[mail.category]}</Badge>
          </div>
          {/* 发件人 / 收件人 / 抄送明细 */}
          <AddressRow label="发件人" addresses={[mail.from]} />
          <AddressRow label="收件人" addresses={mail.to} />
          {mail.cc && mail.cc.length > 0 && <AddressRow label="抄送" addresses={mail.cc} />}
        </div>

        {/* 操作区 */}
        <div className="flex flex-wrap items-center gap-2">
          {onReply && (
            <Button variant="secondary" size="sm" onClick={() => onReply(mail)}>
              <CornerUpLeft size={13} />
              回复
            </Button>
          )}
          {onForward && (
            <Button variant="secondary" size="sm" onClick={() => onForward(mail)}>
              <Forward size={13} />
              转发
            </Button>
          )}
          {onEditDraft && (
            <Button variant="secondary" size="sm" onClick={() => onEditDraft(mail)}>
              <PencilLine size={13} />
              编辑草稿
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => onCreateEvent(mail)}>
            <CalendarPlus size={13} />
            加入日历
          </Button>
          {onDelete && (
            <Button variant="danger" size="sm" onClick={() => onDelete(mail.id)}>
              <Trash2 size={13} />
              删除
            </Button>
          )}
          {mail.taskId && taskTitle && (
            <Button variant="ghost" size="sm" onClick={() => mail.taskId && onOpenTask?.(mail.taskId)}>
              <Layers size={13} />
              所属任务：{taskTitle}
            </Button>
          )}
          {mail.bodyHtml && (
            <Button variant="ghost" size="sm" onClick={() => setShowHtml((v) => !v)}>
              <FileText size={13} />
              {showHtml ? '纯文本视图' : 'HTML 视图'}
            </Button>
          )}
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex flex-col gap-4 px-5 py-4">
        <MailSummaryCard
          mail={mail}
          mailTodos={mailTodos}
          onCreateTodo={onCreateTodo}
          onToggleTodo={onToggleTodo}
          onOpenTodo={onOpenTodo}
          onOpenCalendar={onOpenCalendar}
          onRetry={onRetrySummary}
        />

        {/* 正文 */}
        <div className="rounded-panel bg-white p-4 shadow-card dark:bg-gray-800">
          {showHtml && mail.bodyHtml ? (
            <iframe
              title="邮件内容"
              sandbox=""
              srcDoc={bodySrcDoc}
              className={cn(
                'h-[420px] w-full rounded-lg border border-surface-divider dark:border-gray-700',
                theme === 'dark' ? 'bg-gray-900' : 'bg-white'
              )}
            />
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-6 text-ink dark:text-gray-200">{mail.bodyText || '（无正文内容）'}</p>
          )}
        </div>

        {/* 附件 */}
        {mail.attachments.length > 0 && (
          <div className="rounded-panel bg-white p-4 shadow-card dark:bg-gray-800">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-secondary dark:text-gray-300">
              <Paperclip size={13} />
              附件（{mail.attachments.length}）
            </p>
            <ul className="flex flex-col gap-1.5">
              {mail.attachments.map((attachment, index) => (
                <li
                  key={index}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-lg border border-surface-divider px-3 py-2 text-xs',
                    'text-ink-secondary dark:border-gray-700 dark:text-gray-300'
                  )}
                >
                  <span className="truncate">{attachment.filename}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-ink-muted">{formatSize(attachment.size)}</span>
                    {onDownloadAttachment && (
                      <button
                        onClick={() => onDownloadAttachment(index)}
                        disabled={downloadingAttachment !== null}
                        className="flex items-center gap-1 rounded-md bg-primary-50 px-2 py-1 font-medium text-primary-600 transition-colors hover:bg-primary-100 disabled:opacity-60 dark:bg-primary-950/50 dark:text-primary-400 dark:hover:bg-primary-900/50"
                        title="下载附件"
                      >
                        {downloadingAttachment === index ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                        {downloadingAttachment === index ? '下载中…' : '下载'}
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
