const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const { requireConfirmedTarget } = require('./lib/db-target');

const dryRun = process.argv.includes('--dry-run');
const FILES = ['sql/001-schema.sql', 'sql/002-rls.sql', 'sql/003-seed.sql'];

function parseStatements(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Split on semicolons, filter empty statements
  return content
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
}

async function runStatements(sql, filePath) {
  const statements = parseStatements(filePath);
  for (const stmt of statements) {
    try {
      await sql.query(stmt);
    } catch (e) {
      console.error(`Error in ${filePath}:`, e.message);
      console.error('Statement:', stmt.substring(0, 100) + '...');
      throw e;
    }
  }
  console.log(`✓ ${filePath}`);
}

async function run() {
  const url = requireConfirmedTarget({
    action: 'apply sql/001-schema.sql, sql/002-rls.sql and sql/003-seed.sql',
    dryRun,
  });

  if (dryRun) {
    console.log('Dry run: no writes will be performed.');
    for (const filePath of FILES) {
      const statements = parseStatements(filePath);
      console.log(`  ${filePath}: ${statements.length} statements`);
    }
    return;
  }

  const sql = neon(url);

  for (const filePath of FILES) {
    await runStatements(sql, filePath);
  }

  // Verify
  const vehicles = await sql`SELECT COUNT(*) as count FROM vehicle_master`;
  const items = await sql`SELECT COUNT(*) as count FROM checklist_items`;
  console.log(`\n✓ Vehicles: ${vehicles[0].count}`);
  console.log(`✓ Checklist items: ${items[0].count}`);
}

run().catch(e => { console.error('\nFailed:', e.message); process.exit(1); });
