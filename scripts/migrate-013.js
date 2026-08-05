const { neon } = require('@neondatabase/serverless');
const { requireConfirmedTarget } = require('./lib/db-target');

const dryRun = process.argv.includes('--dry-run');

async function safe(label, fn) {
  try {
    await fn();
    console.log('✓', label);
  } catch (e) {
    const msg = e.message || '';
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      console.log('= already applied:', label);
    } else {
      throw e;
    }
  }
}

(async () => {
  const url = requireConfirmedTarget({
    action: 'apply migration 013 (post_route frequency, mileage + odometer photo columns)',
    dryRun,
  });
  if (dryRun) {
    console.log('Dry run: migration 013 not applied.');
    process.exit(0);
  }
  const sql = neon(url);

  await safe('drop old frequency check', () =>
    sql`ALTER TABLE checklist_items DROP CONSTRAINT IF EXISTS checklist_items_frequency_check`);
  await safe('add new frequency check (daily/weekly/post_route)', () =>
    sql`ALTER TABLE checklist_items ADD CONSTRAINT checklist_items_frequency_check CHECK (frequency IN ('daily', 'weekly', 'post_route'))`);

  await safe('add mileage column', () =>
    sql`ALTER TABLE inspection_logs ADD COLUMN IF NOT EXISTS mileage INTEGER`);
  await safe('add odometer_photo_url column', () =>
    sql`ALTER TABLE inspection_logs ADD COLUMN IF NOT EXISTS odometer_photo_url TEXT`);

  // Idempotent seed: only insert if not already present for this vehicle_type/frequency.
  const existing = await sql`SELECT COUNT(*)::int AS n FROM checklist_items WHERE frequency='post_route'`;
  if (existing[0].n > 0) {
    console.log('= post_route items already seeded, skipping');
  } else {
    const motorcycle = [
      ['Bike Box', 'Bike Box', 1, 'cargo'],
      ['Supplies', 'Supplies', 2, 'supplies'],
    ];
    const car = [
      ['บนคอนโซลหน้า', 'Console area', 1, 'cabin'],
      ['บนเบาะหน้า 2 ด้าน', 'Front seats (both sides)', 2, 'cabin'],
      ['ใต้เบาะหน้า 2 ด้าน', 'Under front seats (both sides)', 3, 'cabin'],
      ['ด้านหลังเบาะคนขับและคนนั่ง', 'Behind driver/passenger seats', 4, 'cabin'],
      ['ไฟในรถ', 'Interior lights', 5, 'cabin'],
      ['เบรคมือ', 'Hand brake', 6, 'cabin'],
      ['สินค้า', 'Cargo/goods', 7, 'cargo'],
      ['การจัดเรียง Supplies', 'Supplies arrangement', 8, 'cargo'],
      ['ถัง', 'Tank', 9, 'cargo'],
      ['ความสะอาดภายในตู้บรรทุก', 'Cargo box cleanliness', 10, 'cargo'],
    ];
    const insertGroup = async (vehicleType, rows) => {
      for (const [th, en, sort, section] of rows) {
        await sql`
          INSERT INTO checklist_items (vehicle_type, frequency, item_name_th, item_name_en, sort_order, section)
          VALUES (${vehicleType}, 'post_route', ${th}, ${en}, ${sort}, ${section})
        `;
      }
    };
    await insertGroup('motorcycle', motorcycle);
    await insertGroup('car', car);
    await insertGroup('e_van', car);
    console.log('✓ seeded post_route items');
  }

  const counts = await sql`
    SELECT vehicle_type, COUNT(*)::int AS n
    FROM checklist_items WHERE frequency = 'post_route'
    GROUP BY vehicle_type ORDER BY vehicle_type
  `;
  console.log('post_route counts:', counts);
})().catch(e => { console.error('Failed:', e); process.exit(1); });
