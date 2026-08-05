const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const { requireConfirmedTarget } = require('./lib/db-target');

const dryRun = process.argv.includes('--dry-run');

async function run() {
  const url = requireConfirmedTarget({ action: 'apply migration 008 (indexes)', dryRun });
  const schema = fs.readFileSync('sql/008-indexes.sql', 'utf8');
  const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
  if (dryRun) {
    console.log(`Dry run: would apply sql/008-indexes.sql (${statements.length} statements). No writes performed.`);
    return;
  }
  const sql = neon(url);
  for (const stmt of statements) {
    await sql.query(stmt);
  }
  console.log('008-indexes.sql applied');
}
run();
