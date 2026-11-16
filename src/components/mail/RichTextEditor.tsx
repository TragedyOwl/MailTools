import { Bold, Eraser, Italic, Link2, List, ListOrdered, Strikethrough, Underline, type LucideIcon } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { cn } from '@/utils/cn';

export interface RichTextEditorHandle {
  /** 获取当前编辑器 HTML 内容 */
  getHtml: () => string;
}

interface RichTextEditorProps {
  /** 初始 HTML 内容（挂载时写入编辑区） */
  initialHtml: string;
  placeholder?: string;
  className?: string;
}

interface ToolItem {
  icon: LucideIcon;
  command: string;
  title: string;
}

const TOOLS: ToolItem[] = [
  { icon: Bold, command: 'bold', title: '加粗' },
  { icon: Italic, command: 'italic', title: '斜体' },
  { icon: Underline, command: 'underline', title: '下划线' },
  { icon: Strikethrough, command: 'strikeThrough', title: '删除线' },
  { icon: List, command: 'insertUnorderedList', title: '无序列表' },
  { icon: ListOrdered, command: 'insertOrderedList', title: '有序列表' },
];

/**
 * 富文本正文编辑器：基于 contentEditable 直接编辑 HTML，
 * 工具栏通过 execCommand 应用格式，内容以 HTML 形式保存与发送。
 */
export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  ({ initialHtml, placeholder = '正文内容…', className }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (editorRef.current) editorRef.current.innerHTML = initialHtml;
    }, [initialHtml]);

    useImperativeHandle(ref, () => ({
      getHtml: () => editorRef.current?.innerHTML ?? '',
    }));

    /** 执行格式命令（mousedown 已阻止默认，保持选区不丢失焦点） */
    const handleCommand = (command: string): void => {
      editorRef.current?.focus();
      document.execCommand(command);
    };

    const handleLink = (): void => {
      const url = window.prompt('输入链接地址', 'https://');
      if (!url || url === 'https://') return;
      editorRef.current?.focus();
      document.execCommand('createLink', false, url);
    };

    const handleClearFormat = (): void => {
      editorRef.current?.focus();
      document.execCommand('removeFormat');
    };

    return (
      <div
        className={cn(
          'overflow-hidden rounded-lg border border-surface-border bg-white transition-colors focus-within:border-primary-500 dark:border-gray-700 dark:bg-gray-800',
          className
        )}
      >
        {/* 格式工具栏 */}
        <div className="flex items-center gap-0.5 border-b border-surface-border px-2 py-1 dark:border-gray-700">
          {TOOLS.map((tool) => (
            <button
              key={tool.command}
              type="button"
              title={tool.title}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleCommand(tool.command)}
              className="rounded p-1.5 text-ink-muted transition-colors hover:bg-black/5 hover:text-ink dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-100"
            >
              <tool.icon size={14} />
            </button>
          ))}
          <button
            type="button"
            title="插入链接"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleLink}
            className="rounded p-1.5 text-ink-muted transition-colors hover:bg-black/5 hover:text-ink dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-100"
          >
            <Link2 size={14} />
          </button>
          <button
            type="button"
            title="清除格式"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleClearFormat}
            className="rounded p-1.5 text-ink-muted transition-colors hover:bg-black/5 hover:text-ink dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-100"
          >
            <Eraser size={14} />
          </button>
        </div>

        {/* HTML 编辑区 */}
        <div
          ref={editorRef}
          contentEditable
          data-placeholder={placeholder}
          className="compose-body max-h-[420px] min-h-[240px] overflow-y-auto px-3 py-2 text-sm leading-6 text-ink outline-none dark:text-gray-200"
        />
      </div>
    );
  }
);

RichTextEditor.displayName = 'RichTextEditor';
