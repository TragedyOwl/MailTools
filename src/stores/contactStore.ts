import { create } from 'zustand';
import type { MailAddress, MailContact } from '@/types';
import { contactRepository } from '@/db/contactRepository';

interface ContactState {
  contacts: MailContact[];
  initFrom: (contacts: MailContact[]) => void;
  /** 记录一批地址（收/发邮件后调用）：已存在的联系人累加次数并刷新时间，新地址自动建档 */
  recordContacts: (addresses: MailAddress[], at?: string) => Promise<void>;
  /** 存量回填：仅补录库中尚不存在的联系人（幂等，不累加已有记录） */
  seedContacts: (contacts: MailContact[]) => Promise<void>;
  reset: () => Promise<void>;
}

/** 排序：往来次数多者优先，其次最近往来时间 */
const sortContacts = (list: MailContact[]): MailContact[] =>
  [...list].sort((a, b) => b.count - a.count || b.lastUsedAt.localeCompare(a.lastUsedAt));

export const useContactStore = create<ContactState>()((set, get) => ({
  contacts: [],

  initFrom: (contacts) => set({ contacts: sortContacts(contacts) }),

  recordContacts: async (addresses, at) => {
    const timestamp = at ?? new Date().toISOString();
    const map = new Map(get().contacts.map((contact) => [contact.email, contact]));
    const touched: MailContact[] = [];

    for (const addr of addresses) {
      const email = addr.email.trim().toLowerCase();
      if (!email || !email.includes('@')) continue;
      const existing = map.get(email);
      const next: MailContact = {
        email,
        name: existing?.name || addr.name.trim(),
        count: (existing?.count ?? 0) + 1,
        lastUsedAt: timestamp,
      };
      map.set(email, next);
      touched.push(next);
    }

    if (touched.length === 0) return;
    await contactRepository.bulkPut(touched);
    set({ contacts: sortContacts([...map.values()]) });
  },

  seedContacts: async (seedList) => {
    if (seedList.length === 0) return;
    const known = new Set(get().contacts.map((contact) => contact.email));
    const fresh = seedList.filter((contact) => !known.has(contact.email));
    if (fresh.length === 0) return;
    await contactRepository.bulkPut(fresh);
    set({ contacts: sortContacts([...get().contacts, ...fresh]) });
  },

  reset: async () => {
    await contactRepository.clear();
    set({ contacts: [] });
  },
}));
