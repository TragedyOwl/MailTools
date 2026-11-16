import { db } from './indexedDB';
import type { MailContact } from '@/types';

/** 联系人（地址簿）仓储 */
export const contactRepository = {
  getAll: (): Promise<MailContact[]> => db.contacts.toArray(),

  bulkPut: (contacts: MailContact[]): Promise<string> => db.contacts.bulkPut(contacts).then(() => 'ok'),

  clear: (): Promise<void> => db.contacts.clear(),
};
