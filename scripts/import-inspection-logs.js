#!/usr/bin/env node

/**
 * Import the DHL inspection export into SVIS.
 *
 * Safe by default: --dry-run reads the database and prints a validation
 * report. A write requires both --confirm and an explicit --company=<slug>.
 * Photos are intentionally never imported.
 */
const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');
const { requireConfirmedTarget } = require('./lib/db-target');
const { resolveCompany } = require('./lib/company-target');

const TYPE_MAP = { 'รถยนต์': 'car', 'E-Van': 'e_van', 'E-Bike': 'e_bike', 'มอเตอร์ไซค์': 'motorcycle' };
const FREQUENCY_MAP = { 'รายวัน': 'daily', 'รายสัปดาห์': 'weekly', 'Post Route': 'post_route' };
const HEADER_SUFFIXES = ['มอเตอร์ไซค์', 'รถยนต์', 'E-Bike', 'E-Van'];
const PHOTO_PREFIX = 'Pic_';
const DETAIL_PREFIX = 'รายละเอียด';

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function clean(value) { return String(value ?? '').replace(/^\uFEFF/, '').trim(); }

function parseThaiDate(value) {
  const match = clean(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, buddhistYear] = match;
  return `${Number(buddhistYear) - 543}-${String(Number(month)).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}`;
}

function sourceResult(value) {
  const normalized = clean(value).replace(/\u0E4D/g, '').toUpperCase();
  if (normalized === 'Y') return 'pass';
  if (normalized === 'N') return 'fail';
  if (!normalized) return null;
  throw new Error(`unsupported checklist value ${JSON.stringify(value)}`);
}

function legacyInspectorId(name) {
  const slug = clean(name).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `legacy:${slug || 'unknown'}`;
}

function sourceHeader(header) {
  const name = clean(header);
  if (!name || name === 'Is_Issue' || name === 'Checked_By' || name.startsWith(PHOTO_PREFIX) || name.startsWith(DETAIL_PREFIX)) return null;
  const suffix = HEADER_SUFFIXES.find((candidate) => name.endsWith(candidate));
  return suffix ? { name: name.slice(0, -suffix.length).trim(), vehicleType: TYPE_MAP[suffix] } : null;
}

function normalizeItemName(name) {
  return clean(name).replace(/\s+/g, ' ').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function findChecklistItem(items, vehicleType, frequency, sourceName) {
  const base = normalizeItemName(sourceName);
  const sameType = items.filter((item) => item.vehicle_type === vehicleType);
  const candidates = sameType.filter((item) => item.frequency === frequency);
  const exact = candidates.filter((item) => normalizeItemName(item.item_name_th) === base);
  if (exact.length === 1) return exact[0];
  const partial = candidates.filter((item) => normalizeItemName(item.item_name_th).startsWith(base) || base.startsWith(normalizeItemName(item.item_name_th)));
  if (partial.length === 1) return partial[0];
  // The export uses the shorter label "ไฟเตือน" for the E-Van dashboard item.
  const aliases = { 'ไฟเตือน': ['ไฟเตือนแดชบอร์ด'], 'Bike Box': ['Bike Box'], 'Supplies': ['Supplies', 'การจัดเรียง Supplies'] };
  const alias = (aliases[base] || []).map((label) => candidates.find((item) => normalizeItemName(item.item_name_th) === label)).filter(Boolean);
  if (alias.length === 1) return alias[0];
  // The export sometimes records a weekly field on a daily row (and vice
  // versa). Preserve the result against the same named checklist item rather
  // than dropping it; the source event remains the inspection frequency.
  const crossFrequency = sameType.filter((item) => normalizeItemName(item.item_name_th) === base);
  if (crossFrequency.length === 1) return crossFrequency[0];
  const crossPartial = sameType.filter((item) => normalizeItemName(item.item_name_th).startsWith(base) || base.startsWith(normalizeItemName(item.item_name_th)));
  return crossPartial.length === 1 ? crossPartial[0] : null;
}

function buildRows(matrix, itemsByKey) {
  const headers = matrix[0] || [];
  const checkColumns = headers.map((header, index) => ({ ...sourceHeader(header), index })).filter((column) => column.name);
  const errors = [], records = [];
  for (let rowNumber = 2; rowNumber <= matrix.length; rowNumber += 1) {
    const row = matrix[rowNumber - 1];
    const inspectionId = clean(row[0]);
    if (!inspectionId && !clean(row[1]) && !clean(row[2])) continue;
    const date = parseThaiDate(row[1]);
    const vehicleType = TYPE_MAP[clean(row[3])];
    const frequency = FREQUENCY_MAP[clean(row[4])];
    const inspectorIndex = headers.indexOf('Checked_By');
    const inspectorNameSource = clean(row[inspectorIndex]);
    const inspectorName = inspectorNameSource || 'Unknown (legacy import)';
    if (!date || !vehicleType || !frequency || !clean(row[2])) {
      errors.push(`row ${rowNumber}: missing/invalid metadata`);
      continue;
    }
    const results = [];
    for (const column of checkColumns) {
      if (column.vehicleType !== vehicleType) continue;
      const result = sourceResult(row[column.index]);
      if (!result) continue;
      const item = findChecklistItem(itemsByKey, vehicleType, frequency, column.name);
      if (!item) errors.push(`row ${rowNumber}: no checklist match for ${JSON.stringify(column.name)} (${vehicleType}/${frequency})`);
      else results.push({ checklistItemId: item.id, result, notes: '' });
    }
    records.push({ sourceId: inspectionId, date, plate: clean(row[2]), vehicleType, frequency, inspectorName, inspectorId: inspectorNameSource ? legacyInspectorId(inspectorNameSource) : 'legacy:unknown', overallStatus: results.some((r) => r.result === 'fail') ? 'fail' : 'pass', results });
  }
  return { records, errors };
}

async function main() {
  const input = process.argv.find((arg) => !arg.startsWith('--') && arg !== process.argv[0] && arg !== __filename);
  if (!input) throw new Error('Usage: node scripts/import-inspection-logs.js /path/to/export.csv --dry-run --company=dhl');
  const matrix = parseCsv(fs.readFileSync(path.resolve(input), 'utf8'));
  if (!matrix.length || matrix[0][0] !== 'Inspection ID') throw new Error('CSV does not look like the DHL inspection export');

  const dryRun = process.argv.includes('--dry-run');
  const { url } = requireConfirmedTarget({ action: `import ${matrix.length - 1} inspection rows`, dryRun });
  const sql = neon(url);
  const company = await resolveCompany(sql, { dryRun });
  const vehicles = await sql`SELECT id, plate_number, company_id FROM vehicle_master WHERE company_id = ${company.id}`;
  const items = await sql`SELECT id, vehicle_type, frequency, item_name_th FROM checklist_items WHERE company_id = ${company.id} AND is_active = true`;
  const { records, errors } = buildRows(matrix, items);
  const vehicleMap = new Map(vehicles.map((vehicle) => [vehicle.plate_number, vehicle]));
  const missingPlates = [...new Set(records.filter((record) => !vehicleMap.has(record.plate)).map((record) => record.plate))];
  console.log(`Inspection import plan${dryRun ? ' (dry run)' : ''}:`);
  console.log(`  source rows: ${matrix.length - 1}`);
  console.log(`  valid rows: ${records.length}`);
  console.log(`  result rows: ${records.reduce((sum, record) => sum + record.results.length, 0)}`);
  console.log(`  failed inspections: ${records.filter((record) => record.overallStatus === 'fail').length}`);
  console.log(`  unmatched plates: ${missingPlates.length}${missingPlates.length ? ` (${missingPlates.join(', ')})` : ''}`);
  const errorSummary = new Map();
  for (const error of errors) {
    const summary = error.replace(/^row \d+: /, '').replace(/^no checklist match for .+? \(([^)]+)\)$/, 'unmapped checklist field ($1)');
    errorSummary.set(summary, (errorSummary.get(summary) || 0) + 1);
  }
  console.log(`  validation errors: ${errors.length}`);
  if (errorSummary.size) console.log([...errorSummary].map(([error, count]) => `  - ${error}: ${count} rows`).join('\n'));
  if (errors.length) console.log(errors.slice(0, 25).map((error) => `  - ${error}`).join('\n'));
  if (missingPlates.length || errors.length) throw new Error('Import validation failed; no rows were written.');
  if (dryRun) { console.log('Dry run complete; no writes performed.'); return; }

  for (const record of records) {
    const vehicle = vehicleMap.get(record.plate);
    const [existing] = await sql`SELECT id FROM inspection_logs WHERE vehicle_id = ${vehicle.id} AND company_id = ${company.id} AND inspection_date = ${record.date} AND frequency = ${record.frequency}`;
    if (existing) continue;
    const [log] = await sql`INSERT INTO inspection_logs (vehicle_id, inspector_id, inspector_name, fleet_id, company_id, inspection_date, overall_status, photo_urls, notes, frequency, mileage, odometer_photo_url, vehicle_usable) VALUES (${vehicle.id}, ${record.inspectorId}, ${record.inspectorName}, (SELECT fleet_id FROM vehicle_master WHERE id = ${vehicle.id}), ${company.id}, ${record.date}, ${record.overallStatus}, ARRAY[]::text[], '', ${record.frequency}, NULL, NULL, NULL) RETURNING id`;
    if (record.results.length) {
      await sql`INSERT INTO inspection_results (inspection_id, checklist_item_id, result, photo_urls, notes) SELECT ${log.id}, r.checklist_item_id::uuid, r.result, ARRAY[]::text[], r.notes FROM json_to_recordset(${JSON.stringify(record.results)}::json) AS r(checklist_item_id text, result text, notes text)`;
    }
  }
  console.log('Import complete. Photos were not imported. Existing matching inspections were skipped.');
}

module.exports = { parseCsv, parseThaiDate, sourceResult, legacyInspectorId, sourceHeader, normalizeItemName, findChecklistItem, buildRows };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exit(1); });
