// One-shot wipe of operational history.
// Preserves: vehicle_master, checklist_items, users (seed data).
// Deletes: inspection_logs (+ cascaded inspection_results), issue_reports,
//          audit_log, and all referenced Vercel Blob photos.
//
// Photo sources cleaned:
//   inspection_logs.photo_urls (TEXT[])
//   inspection_logs.odometer_photo_url (TEXT)
//   inspection_results.photo_urls (TEXT[])  -- per-item failure photos
//   issue_reports.defect_photo_urls (TEXT[])
//   issue_reports.completion_photo_urls (TEXT[])
//
// Run: node scripts/wipe-history.js
// Guard: pass --yes to actually execute. Without it, prints a dry-run count.

const { neon } = require('@neondatabase/serverless');
const { del } = require('@vercel/blob');
const { requireConfirmedTarget } = require('./lib/db-target');

const CONFIRMED = process.argv.includes('--yes');
requireConfirmedTarget({
  action: 'DELETE all inspection history, issue reports, audit log and blob photos',
  dryRun: !CONFIRMED,
});

function isCollectableUrl(u) {
  return typeof u === 'string' && u.startsWith('http') && !u.includes('placeholder');
}

function collectUrls(rows, fields) {
  const set = new Set();
  for (const row of rows) {
    for (const f of fields) {
      const val = row[f];
      if (Array.isArray(val)) {
        for (const u of val) {
          if (isCollectableUrl(u)) set.add(u);
        }
      } else if (isCollectableUrl(val)) {
        set.add(val);
      }
    }
  }
  return [...set];
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing');
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN missing');

  const sql = neon(process.env.DATABASE_URL);

  // 1. Gather all blob URLs referenced in the soon-to-be-deleted rows.
  const insp = await sql`SELECT photo_urls, odometer_photo_url FROM inspection_logs`;
  const results = await sql`SELECT photo_urls FROM inspection_results`;
  const issues = await sql`SELECT defect_photo_urls, completion_photo_urls FROM issue_reports`;

  const urls = [
    ...collectUrls(insp, ['photo_urls', 'odometer_photo_url']),
    ...collectUrls(results, ['photo_urls']),
    ...collectUrls(issues, ['defect_photo_urls', 'completion_photo_urls']),
  ];
  const uniqueUrls = [...new Set(urls)];

  // Pre-count rows.
  const [{ count: inspCount }] = await sql`SELECT COUNT(*)::int AS count FROM inspection_logs`;
  const [{ count: resultCount }] = await sql`SELECT COUNT(*)::int AS count FROM inspection_results`;
  const [{ count: issueCount }] = await sql`SELECT COUNT(*)::int AS count FROM issue_reports`;
  const [{ count: auditCount }] = await sql`SELECT COUNT(*)::int AS count FROM audit_log`;

  console.log('=== wipe-history ===');
  console.log(`inspection_logs:    ${inspCount}`);
  console.log(`inspection_results: ${resultCount} (cascade-deleted with logs)`);
  console.log(`issue_reports:      ${issueCount}`);
  console.log(`audit_log:          ${auditCount}`);
  console.log(`blob photos:        ${uniqueUrls.length}`);

  if (!CONFIRMED) {
    console.log('\nDry run. Re-run with --yes to execute.');
    return;
  }

  // 2. Delete blobs (batched; @vercel/blob del accepts a single URL or array).
  if (uniqueUrls.length > 0) {
    const BATCH = 100;
    for (let i = 0; i < uniqueUrls.length; i += BATCH) {
      const batch = uniqueUrls.slice(i, i + BATCH);
      try {
        await del(batch, { token: process.env.BLOB_READ_WRITE_TOKEN });
        console.log(`  deleted blobs ${i + 1}-${i + batch.length}/${uniqueUrls.length}`);
      } catch (err) {
        console.warn(`  blob delete batch failed (${i}):`, err.message);
      }
    }
  }

  // 3. Delete DB rows in FK-safe order.
  await sql`DELETE FROM issue_reports`;
  await sql`DELETE FROM inspection_logs`; // cascades inspection_results
  await sql`DELETE FROM audit_log`;

  console.log('\n✓ wipe complete');
}

main().catch((e) => {
  console.error('\nFailed:', e.message);
  process.exit(1);
});
