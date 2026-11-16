import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 确认对话框（危险操作二次确认） */
export const ConfirmModal = ({ open, title, message, confirmText = '确认', onConfirm, onCancel }: ConfirmModalProps) => (
  <Modal open={open} title={title} onClose={onCancel} widthClassName="max-w-sm">
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-500" />
        <p className="text-sm text-ink-secondary dark:text-gray-300">{message}</p>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          取消
        </Button>
        <Button variant="danger" size="sm" onClick={onConfirm}>
          {confirmText}
        </Button>
      </div>
    </div>
  </Modal>
);
