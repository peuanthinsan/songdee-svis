const fs = require('node:fs');
const path = require('node:path');
const { neon } = require('@neondatabase/serverless');
const { requireConfirmedTarget } = require('./lib/db-target');

const dryRun = process.argv.includes('--dry-run');
const { url: databaseUrl } = requireConfirmedTarget({
  action: 'apply migration 024 (legacy inspection checklist fields)',
  dryRun,
});
const migrationPath = path.join(__dirname, '..', 'sql', '024-legacy-inspection-checklist-fields.sql');
const statements = fs.readFileSync(migrationPath, 'utf8')
  .replace(/--.*$/gm, '')
  .split(/;\s*(?:\r?\n|$)/)
  .map((statement) => statement.trim())
  .filter(Boolean);

if (dryRun) {
  console.log(`Dry run: migration 024 not applied (${statements.length} statements).`);
  process.exit(0);
}

(async () => {
  const sql = neon(databaseUrl);
  await sql.transaction(statements.map((statement) => sql.query(statement)));
  const result = await sql`
    SELECT COUNT(*)::int AS rows
    FROM checklist_items i
    JOIN companies c ON c.id = i.company_id
    WHERE c.slug = 'dhl'
      AND i.item_name_th IN ('ระบบกระจกไฟฟ้าห้องโดยสาร', 'ยางอะไหล่และเครื่องมือ', 'ระดับน้ำฉีดกระจก', 'ระดับน้ำมันเบรค')
  `;
  console.log(`Migration 024 complete. Legacy checklist rows present: ${result[0].rows}.`);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
