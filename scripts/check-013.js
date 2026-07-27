const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
(async () => {
  const sql = neon(process.env.DATABASE_URL);
  const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='inspection_logs' AND column_name IN ('mileage','odometer_photo_url')`;
  console.log('inspection_logs cols:', cols);
  const checks = await sql`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='checklist_items_frequency_check'`;
  console.log('frequency check:', checks);
  const items = await sql`SELECT vehicle_type, COUNT(*)::int AS n FROM checklist_items WHERE frequency='post_route' GROUP BY vehicle_type`;
  console.log('post_route items:', items);
  const allChk = await sql`SELECT DISTINCT frequency FROM checklist_items`;
  console.log('distinct frequencies:', allChk);
})();
