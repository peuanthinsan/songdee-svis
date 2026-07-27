const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { requireConfirmedTarget } = require('./lib/db-target');

const usersFile = process.env.SVIS_USERS_FILE || path.join(__dirname, 'data-users.json');
const seedPassword = process.env.SVIS_SEED_PASSWORD;
const deactivationAllowlist = new Set(
  (process.env.SVIS_DEACTIVATION_ALLOWLIST || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);
const dryRun = process.argv.includes('--dry-run');

if (!fs.existsSync(usersFile)) {
  throw new Error(`User import file not found: ${usersFile}`);
}

const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));

function roleFor(sourceRole) {
  if (sourceRole === 'Admin - CO') return 'admin';
  if (/^Admin\s*-\s*/i.test(sourceRole)) return 'supervisor';
  return 'driver';
}

function seedUser(user) {
  const username = user.name.toLowerCase().replace(/\s+/g, '_');
  const [firstName, ...lastParts] = user.name.split(' ');
  return {
    username,
    firstName,
    lastName: lastParts.join(' '),
    role: roleFor(user.role),
    fleetId: user.fleet,
  };
}

function needsUpdate(current, desired) {
  return current.first_name !== desired.firstName ||
    current.last_name !== desired.lastName ||
    current.role !== desired.role ||
    current.fleet_id !== desired.fleetId ||
    !current.is_active;
}

async function seedUsers() {
  const desiredUsers = users.map(seedUser);
  const usernames = new Set(desiredUsers.map((user) => user.username));
  if (usernames.size !== desiredUsers.length) {
    throw new Error('data-users.json contains duplicate derived usernames');
  }

  const url = requireConfirmedTarget({ action: `sync ${desiredUsers.length} users`, dryRun });
  const sql = neon(url);
  const existingRows = await sql`
    SELECT username, first_name, last_name, role, fleet_id, is_active
    FROM users
  `;
  const existing = new Map(existingRows.map((user) => [user.username, user]));
  const inserts = desiredUsers.filter((user) => !existing.has(user.username));
  const updates = desiredUsers.filter((user) => {
    const current = existing.get(user.username);
    return current && needsUpdate(current, user);
  });
  const deactivations = existingRows.filter((user) =>
    user.is_active && !usernames.has(user.username) && !deactivationAllowlist.has(user.username)
  );

  console.log(`User sync plan${dryRun ? ' (dry run)' : ''}:`);
  console.log(`  insert: ${inserts.length}`);
  console.log(`  update: ${updates.length}`);
  console.log(`  deactivate: ${deactivations.length}`);
  for (const user of deactivations) console.log(`  deactivate username: ${user.username}`);
  console.log(`  unchanged: ${desiredUsers.length - inserts.length - updates.length}`);
  console.log(`  source users: ${desiredUsers.length}`);

  if (dryRun) {
    console.log('Dry run complete; no writes performed.');
    return;
  }

  if (!seedPassword) {
    throw new Error('Set SVIS_SEED_PASSWORD in your local environment before inserting or updating users.');
  }

  const hash = await bcrypt.hash(seedPassword, 12);
  for (const user of [...inserts, ...updates]) {
    await sql`
      INSERT INTO users (username, password_hash, first_name, last_name, role, fleet_id, is_active)
      VALUES (${user.username}, ${hash}, ${user.firstName}, ${user.lastName}, ${user.role}, ${user.fleetId}, true)
      ON CONFLICT (username) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        fleet_id = EXCLUDED.fleet_id,
        is_active = true,
        updated_at = NOW()
    `;
  }
  for (const user of deactivations) {
    await sql`UPDATE users SET is_active = false, updated_at = NOW() WHERE username = ${user.username}`;
  }

  console.log(`User sync complete: ${inserts.length} inserted, ${updates.length} updated, ${deactivations.length} deactivated.`);
}

seedUsers().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
