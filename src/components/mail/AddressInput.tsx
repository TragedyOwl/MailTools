import { User } from 'lucide-react';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { MailContact } from '@/types';
import { cn } from '@/utils/cn';

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  /** 候选联系人（由页面从地址簿 Store 传入，保持组件纯展示） */
  contacts: MailContact[];
  placeholder?: string;
  autoFocus?: boolean;
}

/** 地址分隔符：逗号/分号（中英文） */
const SEPARATOR_PATTERN = /[,，;；]/;

/** 候选上限 */
const MAX_SUGGESTIONS = 8;

/** 格式化联系人：姓名 <邮箱>（无姓名时仅邮箱） */
const formatContact = (contact: MailContact): string => (contact.name ? `${contact.name} <${contact.email}>` : contact.email);

/** 取输入值中最后一个地址片段（光标补全目标） */
const lastToken = (value: string): string => {
  const parts = value.split(SEPARATOR_PATTERN);
  return (parts[parts.length - 1] ?? '').trim();
};

/**
 * 邮箱地址输入框（类 Foxmail 快速输入）：
 * 输入关键词时下拉展示历史联系人，支持键盘上下选择、Enter/Tab 确认、Esc 关闭。
 */
export const AddressInput = ({ value, onChange, contacts, placeholder, autoFocus }: AddressInputProps) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const token = lastToken(value);

  /** 候选列表：姓名/邮箱包含输入片段，按往来频次排序 */
  const suggestions = useMemo(() => {
    if (!open || token.length === 0) return [];
    const kw = token.toLowerCase();
    return contacts
      .filter((contact) => contact.email !== kw && (contact.email.includes(kw) || contact.name.toLowerCase().includes(kw)))
      .slice(0, MAX_SUGGESTIONS);
  }, [open, token, contacts]);

  const handleSelect = (contact: MailContact): void => {
    // 替换最后一个片段为完整地址，保留此前已输入的地址
    const separatorIdx = Math.max(value.lastIndexOf(','), value.lastIndexOf('，'), value.lastIndexOf(';'), value.lastIndexOf('；'));
    const prefix = separatorIdx >= 0 ? `${value.slice(0, separatorIdx + 1)} ` : '';
    onChange(`${prefix}${formatContact(contact)}, `);
    setOpen(false);
    setActiveIndex(0);
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (!open || suggestions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      handleSelect(suggestions[activeIndex] ?? suggestions[0]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="input-base w-full"
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={suggestions.length > 0}
        aria-label="邮箱地址"
      />
      {suggestions.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-surface-divider bg-white py-1 shadow-card dark:border-gray-700 dark:bg-gray-800">
          {suggestions.map((contact, index) => (
            <li key={contact.email}>
              <button
                type="button"
                // mousedown 先于 input 的 blur 触发，避免下拉在点击前被关闭
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(contact);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-ink-secondary dark:text-gray-300',
                  index === activeIndex && 'bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300'
                )}
              >
                <User size={12} className="shrink-0 text-ink-muted dark:text-gray-500" />
                <span className="truncate">
                  {contact.name && <span className="font-medium">{contact.name} </span>}
                  <span className={cn(!contact.name && 'font-medium')}>{contact.email}</span>
                </span>
                <span className="ml-auto shrink-0 text-[10px] text-ink-muted dark:text-gray-500">往来 {contact.count} 次</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
