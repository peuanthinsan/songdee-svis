import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('dashboard workbook includes saved inspection checklist details', async () => {
  const source = await readFile(new URL('../api/dashboard/export.ts', import.meta.url), 'utf8');

  assert.match(source, /wb\.addWorksheet\('Checklist Detail'/);
  assert.match(source, /LEFT JOIN inspection_results ir ON ir\.inspection_id = il\.id/);
  assert.match(source, /ci\.item_name_th/);
  assert.match(source, /ci\.item_name_en/);
  assert.match(source, /ir\.notes/);
  assert.match(source, /ir\.photo_urls AS result_photo_urls/);
  assert.match(source, /il\.odometer_photo_url/);
  assert.match(source, /checklist\.autoFilter = \{ from: 'A1', to: 'S1' \}/);
});

test('inspection failures use the fleet email entered in the Fleets admin tab', async () => {
  const source = await readFile(new URL('../api/inspections.ts', import.meta.url), 'utf8');

  assert.match(source, /SELECT plate_number, vehicle_type, fleet_manager_email/);
  assert.match(source, /if \(vehicle\?\.fleet_manager_email\)/);
  assert.match(source, /to: vehicle\.fleet_manager_email/);
});
