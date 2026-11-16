import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleAITest } from '../../server/aiCore';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  try {
    const result = await handleAITest(req.body);
    res.status(200).json(result);
  } catch (err) {
    res.status(200).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
