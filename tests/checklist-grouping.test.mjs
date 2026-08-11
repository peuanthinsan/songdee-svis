import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { groupChecklistItems } from '../web/src/checklist-groups.ts';

const mobileChecklist = readFileSync('app/(app)/admin/checklist.tsx', 'utf8');

const items = [
  { id: '5', frequency: 'weekly', vehicle_type: 'van', sort_order: 1, item_name_th: 'จ', item_name_en: 'Echo' },
  { id: '4', frequency: 'daily', vehicle_type: 'van', sort_order: 2, item_name_th: 'ง', item_name_en: 'Delta' },
  { id: '2', frequency: 'daily', vehicle_type: 'car', sort_order: 1, item_name_th: 'ข', item_name_en: 'Bravo' },
  { id: '3', frequency: 'daily', vehicle_type: 'van', sort_order: 1, item_name_th: 'ค', item_name_en: 'Charlie' },
  { id: '1', frequency: 'daily', vehicle_type: 'car', sort_order: 1, item_name_th: 'ก', item_name_en: 'Alpha' },
];

test('checklist groups are ordered by frequency, vehicle type, sort order, and id', () => {
  const groups = groupChecklistItems(items);

  assert.deepEqual(groups.map((group) => group.frequency), ['daily', 'weekly']);
  assert.deepEqual(
    groups[0].vehicleGroups.map((group) => group.vehicleType),
    ['car', 'van'],
  );
  assert.deepEqual(groups[0].vehicleGroups[0].items.map((item) => item.id), ['1', '2']);
  assert.deepEqual(groups[0].vehicleGroups[1].items.map((item) => item.id), ['3', '4']);
  assert.equal(groups[0].itemCount, 4);
});

test('checklist grouping respects frequency, vehicle, and bilingual search filters', () => {
  const filtered = groupChecklistItems(items, {
    frequency: 'daily',
    vehicleType: 'van',
    search: 'char',
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].frequency, 'daily');
  assert.equal(filtered[0].vehicleGroups[0].vehicleType, 'van');
  assert.deepEqual(filtered[0].vehicleGroups[0].items.map((item) => item.id), ['3']);

  const thaiMatch = groupChecklistItems(items, { search: 'จ' });
  assert.deepEqual(thaiMatch[0].vehicleGroups[0].items.map((item) => item.id), ['5']);
});

test('mobile checklist presents frequency before vehicle type', () => {
  assert.ok(
    mobileChecklist.indexOf('{/* Frequency toggle */}')
      < mobileChecklist.indexOf('{/* Vehicle type toggle */}'),
  );
  assert.ok(
    mobileChecklist.indexOf('{/* Frequency picker */}')
      < mobileChecklist.indexOf('{/* Vehicle Type picker */}'),
  );
});
