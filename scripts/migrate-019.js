const fs = require('node:fs');
const path = require('node:path');
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not configured');
}

const migrationPath = path.join(
  __dirname,
  '..',
  'sql',
  '019-multi-company-svis.sql',
);

const statements = fs
  .readFileSync(migrationPath, 'utf8')
  .replace(/--.*$/gm, '')
  .split(/;\s*(?:\r?\n|$)/)
  .map((statement) => statement.trim())
  .filter(Boolean)
  .filter((statement) => !['BEGIN', 'COMMIT'].includes(statement.toUpperCase()));

(async () => {
  const sql = neon(databaseUrl);

  console.log(`Applying migration 019 in one transaction (${statements.length} statements)...`);
  await sql.transaction(statements.map((statement) => sql.query(statement)));

  const companies = await sql`
    SELECT slug, name, is_active
    FROM companies
    ORDER BY sort_order, name
  `;
  const unscoped = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM users WHERE company_id IS NULL) AS users,
      (SELECT COUNT(*)::int FROM vehicle_master WHERE company_id IS NULL) AS vehicles,
      (SELECT COUNT(*)::int FROM checklist_items WHERE company_id IS NULL) AS checklist,
      (SELECT COUNT(*)::int FROM inspection_logs WHERE company_id IS NULL) AS inspections,
      (SELECT COUNT(*)::int FROM issue_reports WHERE company_id IS NULL) AS issues
  `;

  if (Object.values(unscoped[0]).some((count) => Number(count) !== 0)) {
    throw new Error(`Migration left unscoped rows: ${JSON.stringify(unscoped[0])}`);
  }

  console.log(
    `Migration 019 complete. Active companies: ${companies
      .filter((company) => company.is_active)
      .map((company) => company.slug)
      .join(', ')}`,
  );
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
