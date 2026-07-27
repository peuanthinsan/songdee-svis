import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const sql = neon(process.env.DATABASE_URL!);
  try {
    const companies = await sql`
      SELECT slug, name, short_name, primary_color, accent_color
      FROM companies
      WHERE is_active
      ORDER BY sort_order, name
    `;
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json({
      defaultCompanySlug: 'dhl',
      companies: companies.map((company: any) => ({
        slug: company.slug,
        name: company.name,
        shortName: company.short_name,
        primaryColor: company.primary_color,
        accentColor: company.accent_color,
      })),
    });
  } catch (error: any) {
    console.error('[API] Companies error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
