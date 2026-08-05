/**
 * Company (tenant) target guard.
 *
 * Exists because migration 019 made `users` and `vehicle_master` unique per
 * (company_id, ...), not globally. A seed script that does not name its
 * company will either fail its ON CONFLICT target or, worse, sweep another
 * tenant's rows inactive. Resolving by slug rather than hardcoding DHL's
 * UUID keeps the scripts correct for tenants whose ids are generated at
 * insert time.
 */
const DEFAULT_COMPANY_SLUG = 'dhl';

/**
 * Resolve the tenant every write in a seed script must be scoped to.
 *
 * @param {(strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>} sql neon tagged-template client
 * @param {object} [opts]
 * @param {string} [opts.slug] company slug; defaults to SVIS_COMPANY_SLUG, then 'dhl'
 * @returns {Promise<{ id: string, slug: string, name: string }>}
 */
async function resolveCompany(sql, { slug = process.env.SVIS_COMPANY_SLUG || DEFAULT_COMPANY_SLUG } = {}) {
  const rows = await sql`SELECT id, slug, name, is_active FROM companies WHERE slug = ${slug}`;

  if (rows.length === 0) {
    const activeRows = await sql`SELECT slug FROM companies WHERE is_active = true ORDER BY slug`;
    const available = activeRows.map((row) => row.slug).join(', ') || '(none)';
    throw new Error(
      `No company found with slug ${JSON.stringify(slug)}.\n` +
      `Available active company slugs: ${available}`
    );
  }

  const company = rows[0];
  if (!company.is_active) {
    throw new Error(`Company ${JSON.stringify(slug)} is not active; refusing to seed into a disabled tenant.`);
  }

  console.log('──────────────────────────────────────────────');
  console.log(`  COMPANY TARGET  : ${company.slug}`);
  console.log(`  name            : ${company.name}`);
  console.log(`  id              : ${company.id}`);
  console.log('──────────────────────────────────────────────');

  return { id: company.id, slug: company.slug, name: company.name };
}

module.exports = { resolveCompany, DEFAULT_COMPANY_SLUG };
