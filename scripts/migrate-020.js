const fs = require('node:fs');
const path = require('node:path');
const { neon } = require('@neondatabase/serverless');
const { requireConfirmedTarget } = require('./lib/db-target');

const databaseUrl = requireConfirmedTarget({
  action: 'apply migration 020 (persistent login throttling)',
});
const migrationPath = path.join(
  __dirname,
  '..',
  'sql',
  '020-auth-login-throttling.sql',
);
const statements = fs
  .readFileSync(migrationPath, 'utf8')
  .replace(/--.*$/gm, '')
  .split(/;\s*(?:\r?\n|$)/)
  .map((statement) => statement.trim())
  .filter(Boolean);

(async () => {
  const sql = neon(databaseUrl);

  console.log(`Applying migration 020 in one transaction (${statements.length} statements)...`);
  await sql.transaction(statements.map((statement) => sql.query(statement)));

  const result = await sql`
    SELECT COUNT(*)::int AS rows
    FROM auth_login_failures
  `;

  console.log(`Migration 020 complete. Existing failure rows: ${result[0].rows}`);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
