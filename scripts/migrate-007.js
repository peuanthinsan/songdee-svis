const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const { requireConfirmedTarget } = require('./lib/db-target');

const dryRun = process.argv.includes('--dry-run');

async function run() {
  const url = requireConfirmedTarget({ action: 'apply migration 007 (notes)', dryRun });
  const schema = fs.readFileSync('sql/007-notes.sql', 'utf8');
  const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
  if (dryRun) {
    console.log(`Dry run: would apply sql/007-notes.sql (${statements.length} statements). No writes performed.`);
    return;
  }
  const sql = neon(url);
  for (const stmt of statements) {
    await sql.query(stmt);
  }
  console.log('007-notes.sql applied');
}
run();
