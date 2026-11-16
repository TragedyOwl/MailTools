import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { MailTestResponse } from '../../src/types';
import { handleMailTest } from '../../server/imapCore';
import { handleSmtpTest } from '../../server/smtpCore';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  try {
    // IMAP 收件 + SMTP 发件（可选）并行测试
    const [imap, smtp] = await Promise.all([handleMailTest(req.body), handleSmtpTest(req.body)]);
    const result: MailTestResponse = smtp ? { ...imap, smtp } : imap;
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
