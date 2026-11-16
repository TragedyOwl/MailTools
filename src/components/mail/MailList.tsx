import { useEffect, useRef, useState } from 'react';
import { FixedSizeList, type ListChildComponentProps, type ListOnScrollProps } from 'react-window';
import type { Mail } from '@/types';
import { MailCard } from './MailCard';

const ROW_HEIGHT = 96;

interface MailListProps {
  mails: Mail[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  hasMoreOld: boolean;
  isLoadingOlder: boolean;
  onLoadOlder: () => void;
}

interface RowData {
  mails: Mail[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const Row = ({ index, style, data }: ListChildComponentProps<RowData>) => {
  const mail = data.mails[index];
  return (
    <div style={style}>
      <MailCard mail={mail} selected={mail.id === data.selectedId} onSelect={data.onSelect} />
    </div>
  );
};

/** 监听容器尺寸 */
const useContainerSize = (ref: React.RefObject<HTMLDivElement>): { width: number; height: number } => {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 先同步测量一次：避免 ResizeObserver 回调被节流/延迟时列表长期空白
    const initial = el.getBoundingClientRect();
    setSize({ width: initial.width, height: initial.height });
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setSize({ width: rect.width, height: rect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return size;
};

/** 邮件列表（虚拟滚动 + 触底加载更早邮件） */
export const MailList = ({ mails, selectedId, onSelect, hasMoreOld, isLoadingOlder, onLoadOlder }: MailListProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<FixedSizeList<RowData>>(null);
  const { height } = useContainerSize(containerRef);

  // 选中项变化时滚动到可视区域
  useEffect(() => {
    if (!selectedId) return;
    const index = mails.findIndex((mail) => mail.id === selectedId);
    if (index >= 0) listRef.current?.scrollToItem(index, 'smart');
  }, [selectedId, mails]);

  const handleScroll = (props: ListOnScrollProps): void => {
    if (!hasMoreOld || isLoadingOlder || mails.length === 0) return;
    const totalHeight = mails.length * ROW_HEIGHT;
    if (props.scrollOffset + height > totalHeight - ROW_HEIGHT * 3) {
      onLoadOlder();
    }
  };

  return (
    <div ref={containerRef} className="h-full min-h-0">
      {height > 0 && (
        <FixedSizeList<RowData>
          ref={listRef}
          height={height}
          width="100%"
          itemCount={mails.length}
          itemSize={ROW_HEIGHT}
          itemData={{ mails, selectedId, onSelect }}
          onScroll={handleScroll}
          overscanCount={5}
        >
          {Row}
        </FixedSizeList>
      )}
      {isLoadingOlder && <p className="py-2 text-center text-xs text-ink-muted">正在加载更早的邮件…</p>}
    </div>
  );
};
