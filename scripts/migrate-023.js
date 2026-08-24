const fs = require('node:fs');
const path = require('node:path');
const { neon } = require('@neondatabase/serverless');
const { requireConfirmedTarget } = require('./lib/db-target');

const { url: databaseUrl, dryRun } = requireConfirmedTarget({
  action: 'apply migration 023 (light truck and 6-wheel truck vehicle types)',
  dryRun: process.argv.includes('--dry-run'),
});
const migrationPath = path.join(__dirname, '..', 'sql', '023-add-truck-vehicle-types.sql');
const statements = fs
  .readFileSync(migrationPath, 'utf8')
  .replace(/--.*$/gm, '')
  .split(/;\s*(?:\r?\n|$)/)
  .map((statement) => statement.trim())
  .filter(Boolean);

if (dryRun) {
  console.log(`Dry run: migration 023 not applied (${statements.length} statements).`);
  process.exit(0);
}

(async () => {
  const sql = neon(databaseUrl);
  await sql.transaction(statements.map((statement) => sql.query(statement)));
  console.log('Migration 023 complete. Truck vehicle types are available.');
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
