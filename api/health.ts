import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`SELECT 1`;
    res.status(200).json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(500).json({ status: 'error' });
  }
}
