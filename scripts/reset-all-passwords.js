const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const { requireConfirmedTarget } = require('./lib/db-target');

// Matches BCRYPT_ROUNDS in lib/api-auth.ts. bcrypt.compare reads the cost
// factor from the stored hash, so existing logins keep working regardless.
const BCRYPT_ROUNDS = 12;

async function run() {
  const newPassword = process.argv[2];
  if (!newPassword) {
    console.error('Usage: node scripts/reset-all-passwords.js <new-password>');
    process.exit(1);
  }

  const url = requireConfirmedTarget({ action: 'reset the password of EVERY user' });
  const sql = neon(url);
  const users = await sql`SELECT id, username FROM users`;
  if (users.length === 0) {
    console.error('No users found.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  for (const u of users) {
    await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${u.id}`;
    console.log(`✓ Reset password for: ${u.username}`);
  }

  console.log(`\nReset ${users.length} user(s).`);
}

run().catch(e => { console.error('Failed:', e.message); process.exit(1); });
