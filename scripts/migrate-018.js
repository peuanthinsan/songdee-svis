const { neon } = require('@neondatabase/serverless');
const { requireConfirmedTarget } = require('./lib/db-target');

(async () => {
  const url = requireConfirmedTarget({
    action: 'apply migration 018 (e_bike type, is_active flags, van/e_bike checklists)',
    dryRun: process.argv.includes('--dry-run'),
  });
  if (process.argv.includes('--dry-run')) {
    console.log('Dry run: migration 018 not applied.');
    process.exit(0);
  }
  const sql = neon(url);

  await sql`ALTER TABLE vehicle_master DROP CONSTRAINT IF EXISTS vehicle_master_vehicle_type_check`;
  await sql`ALTER TABLE vehicle_master ADD CONSTRAINT vehicle_master_vehicle_type_check
    CHECK (vehicle_type IN ('car', 'van', 'e_van', 'motorcycle', 'e_bike'))`;
  console.log('✓ vehicle_master vehicle type constraint updated');

  await sql`ALTER TABLE checklist_items DROP CONSTRAINT IF EXISTS checklist_items_vehicle_type_check`;
  await sql`ALTER TABLE checklist_items ADD CONSTRAINT checklist_items_vehicle_type_check
    CHECK (vehicle_type IN ('car', 'van', 'e_van', 'motorcycle', 'e_bike'))`;
  console.log('✓ checklist_items vehicle type constraint updated');

  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`;
  await sql`ALTER TABLE vehicle_master ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`;
  console.log('✓ users.is_active and vehicle_master.is_active added');

  await sql`
    INSERT INTO checklist_items (vehicle_type, frequency, item_name_th, item_name_en, sort_order, section)
    SELECT 'van', frequency, item_name_th, item_name_en, sort_order, section
    FROM checklist_items
    WHERE vehicle_type = 'car'
      AND NOT EXISTS (SELECT 1 FROM checklist_items WHERE vehicle_type = 'van')
  `;
  await sql`
    INSERT INTO checklist_items (vehicle_type, frequency, item_name_th, item_name_en, sort_order, section)
    SELECT 'e_bike', frequency, item_name_th, item_name_en, sort_order, section
    FROM checklist_items
    WHERE vehicle_type = 'motorcycle'
      AND NOT EXISTS (SELECT 1 FROM checklist_items WHERE vehicle_type = 'e_bike')
  `;
  console.log('✓ van and e_bike checklists seeded');

  console.log('Migration 018 complete.');
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
