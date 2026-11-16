import { AlertCircle, Send, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ComposeDraft } from '@/utils/composeUtils';
import { buildDraftMail, buildSentMail, parseAddressInput } from '@/utils/composeUtils';
import { htmlToText } from '@/utils/htmlText';
import { useMailStore } from '@/stores/mailStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useContactStore } from '@/stores/contactStore';
import { sendMail } from '@/services/mailService';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { RichTextEditor, type RichTextEditorHandle } from './RichTextEditor';
import { AddressInput } from './AddressInput';

interface ComposeModalProps {
  /** 预填充草稿（id 已存在于邮件库则视为编辑草稿，否则为新建） */
  draft: ComposeDraft;
  onClose: () => void;
}

/** 写信弹窗：新写 / 回复 / 转发 / 编辑草稿共用 */
export const ComposeModal = ({ draft, onClose }: ComposeModalProps) => {
  const isExistingDraft = useMailStore((s) => s.mails.some((mail) => mail.id === draft.id));
  // 地址簿：收发邮件自动累积的联系人，供收件人/抄送快速补全
  const contacts = useContactStore((s) => s.contacts);

  const [to, setTo] = useState(draft.to);
  const [cc, setCc] = useState(draft.cc);
  const [subject, setSubject] = useState(draft.subject);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // 正文基于 HTML 编辑：内容存在编辑器内，提交时通过句柄读取
  const editorRef = useRef<RichTextEditorHandle>(null);

  const handleSend = async (): Promise<void> => {
    if (sending) return;
    setError(null);

    const toList = parseAddressInput(to);
    if (toList.length === 0) {
      setError('请填写至少一个收件人邮箱');
      return;
    }
    const account = useSettingsStore.getState().getDecryptedAccount();
    if (!account) {
      setError('尚未配置邮箱账号，请先前往设置页完成配置');
      return;
    }
    if (!account.smtp) {
      setError('未配置发件服务器（SMTP），请在设置页补充后重试');
      return;
    }

    setSending(true);
    try {
      const bodyHtml = editorRef.current?.getHtml() ?? '';
      const current: ComposeDraft = { ...draft, to, cc, subject, body: bodyHtml };
      const response = await sendMail(
        { ...account, smtp: account.smtp },
        {
          to: toList.map((addr) => addr.email),
          cc: parseAddressInput(cc).map((addr) => addr.email),
          subject: subject.trim() || '(无主题)',
          // 纯文本降级内容 + HTML 正文（multipart/alternative）
          body: htmlToText(bodyHtml),
          html: bodyHtml || undefined,
          inReplyTo: draft.inReplyTo,
          references: draft.references,
        }
      );
      if (!response.ok) throw new Error(response.error ?? '发送失败');

      const nowIso = new Date().toISOString();
      // 清除草稿记录（若存在）→ 已发送入库 → 进入 AI 摘要流水线（摘要→待办→日历）
      await useMailStore.getState().deleteMail(draft.id);
      const sent = buildSentMail({
        draft: current,
        selfEmail: account.user,
        messageId: response.messageId ?? `local-${draft.id}`,
        nowIso,
      });
      await useMailStore.getState().recordSentMail(sent);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async (): Promise<void> => {
    const selfEmail = useSettingsStore.getState().mailAccount?.user ?? '';
    const bodyHtml = editorRef.current?.getHtml() ?? '';
    const mail = buildDraftMail({ ...draft, to, cc, subject, body: bodyHtml }, selfEmail, new Date().toISOString());
    await useMailStore.getState().saveDraft(mail);
    onClose();
  };

  const handleDiscard = async (): Promise<void> => {
    await useMailStore.getState().deleteMail(draft.id);
    setConfirmDiscard(false);
    onClose();
  };

  return (
    <>
      <Modal open title={isExistingDraft ? '编辑草稿' : '写邮件'} onClose={onClose} widthClassName="max-w-2xl">
        <div className="flex flex-col gap-3">
          {/* 收件人（输入时自动补全历史联系人） */}
          <div className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-right text-xs text-ink-muted dark:text-gray-500">收件人</span>
            <AddressInput value={to} onChange={setTo} contacts={contacts} placeholder="多个地址用逗号分隔" autoFocus />
          </div>

          {/* 抄送（常驻显示） */}
          <div className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-right text-xs text-ink-muted dark:text-gray-500">抄送</span>
            <AddressInput value={cc} onChange={setCc} contacts={contacts} placeholder="多个地址用逗号分隔" />
          </div>

          {/* 主题 */}
          <div className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-right text-xs text-ink-muted dark:text-gray-500">主题</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="邮件主题" className="input-base flex-1" />
          </div>

          {/* 正文（HTML 富文本编辑） */}
          <RichTextEditor ref={editorRef} initialHtml={draft.body} />

          {/* 错误提示 */}
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
              <AlertCircle size={13} className="shrink-0" />
              {error}
            </p>
          )}

          {/* 操作 */}
          <div className="flex items-center justify-between pt-1">
            {isExistingDraft ? (
              <Button variant="danger" size="sm" onClick={() => setConfirmDiscard(true)}>
                <Trash2 size={13} />
                删除草稿
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => void handleSaveDraft()}>
                存草稿
              </Button>
              <Button size="sm" onClick={() => void handleSend()} disabled={sending}>
                <Send size={13} />
                {sending ? '发送中…' : '发送'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmDiscard}
        title="删除草稿"
        message="确定删除这封草稿吗？删除后不可恢复。"
        confirmText="删除"
        onConfirm={() => void handleDiscard()}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
};
