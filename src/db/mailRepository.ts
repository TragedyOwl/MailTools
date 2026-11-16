import { db } from './indexedDB';
import type { Mail } from '@/types';

/** 邮件仓储：所有邮件持久化操作的唯一入口 */
export const mailRepository = {
  getAll: (): Promise<Mail[]> => db.mails.orderBy('date').reverse().toArray(),

  getById: (id: string): Promise<Mail | undefined> => db.mails.get(id),

  getByMessageIds: (messageIds: string[]): Promise<Mail[]> =>
    db.mails.where('messageId').anyOf(messageIds).toArray(),

  bulkPut: (mails: Mail[]): Promise<string> => db.mails.bulkPut(mails).then(() => 'ok'),

  update: (id: string, patch: Partial<Mail>): Promise<number> => db.mails.update(id, patch),

  delete: (id: string): Promise<void> => db.mails.delete(id),

  count: (): Promise<number> => db.mails.count(),

  minUid: async (): Promise<number> => {
    const first = await db.mails.orderBy('uid').first();
    return first?.uid ?? 0;
  },

  clear: (): Promise<void> => db.mails.clear(),
};
