// INTENTIONALLY BROKEN — this file is a test fixture, not a real script.
//
// It exists only to prove that db-target-guard.test.mjs's `dialedTheTarget()`
// detector actually fails when it should — see the self-test in
// tests/db-target-guard.test.mjs that runs this file. It commits the exact
// defect this whole task exists to eliminate:
//
//   1. it destructures `{ url }` from requireConfirmedTarget() and DISCARDS
//      the returned `dryRun` flag, instead of branching on it;
//   2. it calls neon(url) and issues a write unconditionally, even though
//      the caller asked for --dry-run;
//   3. it swallows the resulting write failure in a catch block (the same
//      shape scripts/wipe-history.js already uses for its blob-delete
//      batches, at the line the semantic review flagged) and prints a false
//      "no writes performed" message regardless of what actually happened.
//
// SAFETY LATCH, not just a comment: requiring scripts/lib/db-target below
// loads .env.local through dotenv, so a bare `node tests/fixtures/
// leaky-caller.js --dry-run` run from a real checkout would announce and
// dial whatever DATABASE_URL is actually configured there — including a
// real production database — and execute the CREATE TABLE below against it.
// A "never run this by hand" comment cannot stop that; only code can. The
// LEAK_CANARY_SELF_TEST env check immediately below is that code: it must
// run before any require() in this file, because requiring db-target.js is
// itself the unsafe operation. Only tests/db-target-guard.test.mjs's
// self-test is allowed to set that variable, and it does so explicitly via
// envOverrides, scoped to that one spawned child process.
//
// This file is NEVER run in production, NEVER imported by any real script,
// and NEVER referenced from scripts/. It lives under tests/fixtures/ (not
// scripts/) specifically so it cannot be mistaken for a real write script,
// and its plain .js extension (not .test.mjs) keeps `npm test`'s
// `tests/*.test.mjs` glob from ever picking it up and running it as a test
// file in its own right.

if (process.env.LEAK_CANARY_SELF_TEST !== '1') {
  console.error(
    'leaky-caller.js is an intentionally broken test fixture. It is not runnable directly: ' +
    'it issues a real write against whatever DATABASE_URL names. Only ' +
    'tests/db-target-guard.test.mjs may run it, via LEAK_CANARY_SELF_TEST=1.'
  );
  process.exit(1);
}

const { neon } = require('@neondatabase/serverless');
const { requireConfirmedTarget } = require('../../scripts/lib/db-target');

const dryRun = process.argv.includes('--dry-run');

(async () => {
  const { url } = requireConfirmedTarget({ action: 'leak test', dryRun });

  // BUG, deliberately: no `if (dryRun) return` here. A correct caller must
  // branch on `dryRun` before ever calling neon().
  const sql = neon(url);

  try {
    await sql`CREATE TABLE IF NOT EXISTS leak_canary (id int)`;
  } catch (err) {
    // BUG, deliberately: swallowing the failure instead of surfacing it.
    console.warn('  write batch failed:', err.message);
  }

  console.log('Dry run complete; no writes performed.');
})();
