import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const importer = require('../scripts/import-inspection-logs.js');

test('inspection import normalizes dates, values, and legacy inspector ids', () => {
  assert.equal(importer.parseThaiDate('9/7/2569'), '2026-07-09');
  assert.equal(importer.sourceResult('ํY'), 'pass');
  assert.equal(importer.sourceResult('N'), 'fail');
  assert.equal(importer.legacyInspectorId('John Smith'), 'legacy:john-smith');
});

test('inspection import ignores photo/detail columns and creates normalized results', () => {
  const matrix = [
    ['Inspection ID', 'Date', 'Vehicle No', 'Vehicle Type', 'Event', 'สัญญาณแตรรถยนต์', 'Pic_สัญญาณแตรรถยนต์', 'รายละเอียดสัญญาณแตรรถยนต์', 'Checked_By'],
    ['abc12345', '9/7/2569', '701-1', 'รถยนต์', 'รายวัน', 'ํY', 'Inspection_Logs_Images/x.jpg', 'ok', 'John Smith'],
  ];
  const items = [{ id: 'item-1', vehicle_type: 'car', frequency: 'daily', item_name_th: 'สัญญาณแตร' }];
  const result = importer.buildRows(matrix, items);
  assert.equal(result.errors.length, 0);
  assert.deepEqual(result.records[0].results, [{ checklistItemId: 'item-1', result: 'pass', notes: '' }]);
  assert.equal(result.records[0].overallStatus, 'pass');
});

test('inspection import keeps rows with a blank legacy inspector name', () => {
  const matrix = [
    ['Inspection ID', 'Date', 'Vehicle No', 'Vehicle Type', 'Event', 'Checked_By'],
    ['abc12345', '9/7/2569', '701-1', 'รถยนต์', 'รายวัน', ''],
  ];
  const result = importer.buildRows(matrix, []);
  assert.equal(result.errors.length, 0);
  assert.equal(result.records[0].inspectorName, 'Unknown (legacy import)');
  assert.equal(result.records[0].inspectorId, 'legacy:unknown');
});
