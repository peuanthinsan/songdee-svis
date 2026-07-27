const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const { requireConfirmedTarget } = require('./lib/db-target');

async function run() {
  const newPassword = process.env.SVIS_ADMIN_PASSWORD;
  if (!newPassword) {
    console.error('Set SVIS_ADMIN_PASSWORD in your local environment before running this script.');
    process.exit(1);
  }
  const url = requireConfirmedTarget({ action: 'reset EVERY admin password' });
  const sql = neon(url);

  const admins = await sql`SELECT id, username FROM users WHERE role = 'admin'`;
  if (admins.length === 0) {
    console.error('No admin users found.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(newPassword, 10);

  for (const u of admins) {
    await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${u.id}`;
    console.log(`✓ Reset password for admin: ${u.username}`);
  }

  console.log(`\nReset ${admins.length} admin password(s).`);
}

run().catch(e => { console.error('Failed:', e.message); process.exit(1); });
