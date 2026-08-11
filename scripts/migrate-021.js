const fs = require('node:fs');
const path = require('node:path');
const { neon } = require('@neondatabase/serverless');
const { requireConfirmedTarget } = require('./lib/db-target');

const { url: databaseUrl } = requireConfirmedTarget({
  action: 'apply migration 021 (retire checklist items safely)',
});
const migrationPath = path.join(__dirname, '..', 'sql', '021-checklist-active.sql');
const statements = fs
  .readFileSync(migrationPath, 'utf8')
  .replace(/--.*$/gm, '')
  .split(/;\s*(?:\r?\n|$)/)
  .map((statement) => statement.trim())
  .filter(Boolean);

(async () => {
  const sql = neon(databaseUrl);
  await sql.transaction(statements.map((statement) => sql.query(statement)));
  console.log('Migration 021 complete. Checklist items now support safe retirement.');
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
