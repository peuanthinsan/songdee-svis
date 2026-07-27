/**
 * Database target guard.
 *
 * Exists because every script in this repo reads .env.local and there is no
 * dev/prod distinction — whatever DATABASE_URL happens to name IS what gets
 * written. On 2026-07-25 a stale .env.local pointed at a decommissioned
 * us-east-1 Neon endpoint while production had moved to ap-southeast-1; a
 * migration and a full data import landed in the dead database and were
 * reported as successful, because the verification queries read the same file.
 * Deploying code that depended on the new column then took production down.
 *
 * So: no script may write to a database it has not named out loud, and no
 * write happens without an explicit --confirm. Reading is always allowed.
 */
const path = require('path');

// Resolve .env.local relative to the repo, not the caller's cwd, so scripts
// behave identically wherever they are invoked from. dotenv does not override
// variables already present in the environment, so an explicit
// `DATABASE_URL=... node scripts/foo.js` still wins.
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env.local'), quiet: true });

const KNOWN_REGIONS = [
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-south-1',
  'us-east-1', 'us-east-2', 'us-west-2', 'eu-central-1', 'eu-west-1', 'eu-west-2',
];

/** Split a Postgres URL into the parts worth showing a human, never the password. */
function describeTarget(connectionString) {
  try {
    const u = new URL(connectionString);
    const host = u.hostname;
    return {
      host,
      database: u.pathname.replace(/^\//, '') || '(default)',
      region: KNOWN_REGIONS.find((r) => host.includes(r)) || 'unknown-region',
    };
  } catch {
    return { host: '(unparseable)', database: '(unknown)', region: 'unknown-region' };
  }
}

/** The connection string every script should use. Throws rather than silently connecting to nothing. */
function resolveDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Expected it in .env.local at the repo root, or passed inline.\n' +
      'Refresh it with: vercel env pull .env.local --environment=production --yes'
    );
  }
  return url;
}

/** Print the target so it appears in the transcript above any output that follows. */
function announceTarget(connectionString) {
  const { host, database, region } = describeTarget(connectionString);
  console.log('──────────────────────────────────────────────');
  console.log(`  DATABASE TARGET : ${host}`);
  console.log(`  database        : ${database}`);
  console.log(`  region          : ${region}`);
  console.log('──────────────────────────────────────────────');
  return { host, database, region };
}

/**
 * Gate for any script that writes. Announces the target, then refuses unless the
 * caller passed --confirm (or --dry-run, which performs no writes anyway).
 *
 * @param {object}  opts
 * @param {string}  opts.action  human description, e.g. 'seed 359 vehicles'
 * @param {boolean} opts.dryRun  true when the script will not write
 * @param {string[]} [opts.argv] defaults to process.argv
 * @returns {string} the connection string to use
 */
function requireConfirmedTarget({ action, dryRun = false, argv = process.argv }) {
  const url = resolveDatabaseUrl();
  const { host, region } = announceTarget(url);

  if (dryRun) {
    console.log('Mode: DRY RUN — no writes will be performed.\n');
    return url;
  }

  if (argv.includes('--confirm')) {
    console.log(`Mode: WRITE — confirmed. Action: ${action}\n`);
    return url;
  }

  console.error(
    `\nRefusing to ${action} without confirmation.\n\n` +
    `This would WRITE to ${host} (${region}).\n` +
    `Check that host is the one production actually uses:\n\n` +
    `    vercel env pull /tmp/p.env --environment=production --yes \\\n` +
    `      && grep '^DATABASE_URL=' /tmp/p.env | sed -E 's|.*@([^/]+)/.*|\\1|' && rm /tmp/p.env\n\n` +
    `Then re-run with --dry-run to preview, or --confirm to write.\n`
  );
  process.exit(1);
}

module.exports = { describeTarget, resolveDatabaseUrl, announceTarget, requireConfirmedTarget };
