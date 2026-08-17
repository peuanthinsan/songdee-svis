import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  buildChecklistImportPayload,
  parseChecklistImportMatrix,
  parseCsvMatrix,
} from '../web/src/checklist-import.ts';
import {
  ChecklistInputError,
  normalizeChecklistImport,
  normalizeChecklistOrder,
} from '../lib/checklist-admin.ts';

const checklistApi = readFileSync('api/admin/checklist.ts', 'utf8');
const checklistUi = readFileSync('web/src/pages/admin/ChecklistTab.tsx', 'utf8');
const webPackage = JSON.parse(readFileSync('web/package.json', 'utf8'));

test('CSV checklist import supports quoted cells and selected-tab defaults', () => {
  const matrix = parseCsvMatrix([
    '\uFEFFitem_name_th,item_name_en,frequency,vehicle_type',
    '"ตรวจยาง, ลมยาง","Check tires, pressure",,',
    'ตรวจไฟ,Check lights,post route,e-van',
  ].join('\r\n'));
  const rows = parseChecklistImportMatrix(matrix, { frequency: 'weekly', vehicleType: 'van' });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].itemNameTh, 'ตรวจยาง, ลมยาง');
  assert.equal(rows[0].itemNameEn, 'Check tires, pressure');
  assert.equal(rows[0].frequency, 'weekly');
  assert.equal(rows[0].vehicleType, 'van');
  assert.equal(rows[0].issues.length, 0);
  assert.equal(rows[1].frequency, 'post_route');
  assert.equal(rows[1].vehicleType, 'e_van');
});

test('import preview identifies invalid names, frequency, and vehicle type', () => {
  const rows = parseChecklistImportMatrix([
    ['thai_name', 'english_name', 'frequency', 'vehicle_type'],
    ['', 'Check horn', 'monthly', 'truck'],
    ['ตรวจไฟ', '', 'daily', 'car'],
  ], { frequency: 'daily', vehicleType: 'car' });

  assert.deepEqual(rows[0].issues, ['missing_thai_name', 'invalid_frequency', 'invalid_vehicle_type']);
  assert.deepEqual(rows[1].issues, ['missing_english_name']);
});

test('valid imported rows append in file order inside each checklist group', () => {
  const rows = parseChecklistImportMatrix([
    ['item_name_th', 'item_name_en', 'frequency', 'vehicle_type'],
    ['ก', 'Alpha', 'weekly', 'van'],
    ['ข', 'Bravo', 'weekly', 'van'],
    ['', 'Invalid', 'daily', 'car'],
    ['ค', 'Charlie', 'daily', 'car'],
  ], { frequency: 'daily', vehicleType: 'car' });
  const payload = buildChecklistImportPayload(rows, [
    { id: '1', item_name_th: 'เดิม', item_name_en: 'Existing', frequency: 'weekly', vehicle_type: 'van', sort_order: 4 },
    { id: '2', item_name_th: 'เดิม', item_name_en: 'Existing', frequency: 'daily', vehicle_type: 'car', sort_order: 8 },
  ]);

  assert.deepEqual(payload.map((item) => [item.itemNameEn, item.sortOrder]), [
    ['Alpha', 5],
    ['Bravo', 6],
    ['Charlie', 9],
  ]);
});

test('bulk API validation trims imports and rejects unsafe reorder batches', () => {
  assert.deepEqual(normalizeChecklistImport([{
    itemNameTh: '  ตรวจยาง  ',
    itemNameEn: ' Check tires ',
    frequency: 'daily',
    vehicleType: 'van',
    sortOrder: 1,
  }]), [{
    itemNameTh: 'ตรวจยาง',
    itemNameEn: 'Check tires',
    frequency: 'daily',
    vehicleType: 'van',
    sortOrder: 1,
  }]);

  const id = '67b5a814-7460-4c8e-970c-62d12e8cd2cb';
  assert.deepEqual(normalizeChecklistOrder([{ id, sortOrder: 2 }]), [{ id, sortOrder: 2 }]);
  assert.throws(
    () => normalizeChecklistOrder([{ id, sortOrder: 1 }, { id, sortOrder: 2 }]),
    ChecklistInputError,
  );
});

test('checklist API uses atomic JSON batches and UI exposes accessible reordering', () => {
  assert.match(checklistApi, /jsonb_to_recordset/);
  assert.match(checklistApi, /\(SELECT COUNT\(\*\) FROM authorized\) = \$\{updates\.length\}/);
  assert.match(checklistUi, /draggable=\{canReorder\}/);
  assert.match(checklistUi, /event\.key === 'ArrowUp' \|\| event\.key === 'ArrowDown'/);
  assert.match(checklistUi, /ChecklistImportDialog/);
  assert.equal(webPackage.dependencies['read-excel-file'], '^9.3.10');
});
