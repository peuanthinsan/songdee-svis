const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function runStatements(sql, filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Split on semicolons, filter empty statements
  const statements = content
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

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
  const sql = neon(process.env.DATABASE_URL);

  await runStatements(sql, 'sql/001-schema.sql');
  await runStatements(sql, 'sql/002-rls.sql');
  await runStatements(sql, 'sql/003-seed.sql');

  // Verify
  const vehicles = await sql`SELECT COUNT(*) as count FROM vehicle_master`;
  const items = await sql`SELECT COUNT(*) as count FROM checklist_items`;
  console.log(`\n✓ Vehicles: ${vehicles[0].count}`);
  console.log(`✓ Checklist items: ${items[0].count}`);
}

run().catch(e => { console.error('\nFailed:', e.message); process.exit(1); });
