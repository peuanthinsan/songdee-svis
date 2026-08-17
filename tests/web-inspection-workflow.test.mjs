import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  activeInspectionQuery,
  getMondayOfWeekThai,
  getTodayThai,
  itemsForZone,
  validateInspectionDraft,
} from '../web/src/inspection-workflow.ts';

const items = [
  { id: 'front', section: 'front' },
  { id: 'rear', section: 'rear' },
  { id: 'cabin', section: 'cabin' },
  { id: 'cargo', section: 'cargo' },
  { id: 'tires', section: 'underbody' },
];

test('PC inspection dates follow the Bangkok calendar and weekly scope starts Monday', () => {
  const mondayInBangkok = new Date('2026-08-09T18:30:00.000Z');
  assert.equal(getTodayThai(mondayInBangkok), '2026-08-10');
  assert.equal(getMondayOfWeekThai(mondayInBangkok), '2026-08-10');

  const sundayInBangkok = new Date('2026-08-09T10:00:00.000Z');
  assert.equal(getMondayOfWeekThai(sundayInBangkok), '2026-08-03');
});

test('active inspection queries keep each frequency isolated', () => {
  const now = new Date('2026-08-11T03:00:00.000Z');
  assert.equal(activeInspectionQuery('vehicle-1', 'daily', now).toString(), 'vehicleId=vehicle-1&frequency=daily&date=2026-08-11');
  assert.equal(activeInspectionQuery('vehicle-1', 'post_route', now).toString(), 'vehicleId=vehicle-1&frequency=post_route&date=2026-08-11');
  assert.equal(activeInspectionQuery('vehicle-1', 'weekly', now).toString(), 'vehicleId=vehicle-1&frequency=weekly&since=2026-08-10');
});

test('zone tabs replace the checklist with only the selected vehicle area', () => {
  assert.deepEqual(itemsForZone(items, null).map((item) => item.id), ['front', 'rear', 'cabin', 'cargo', 'tires']);
  assert.deepEqual(itemsForZone(items, 'front').map((item) => item.id), ['front']);
  assert.deepEqual(itemsForZone(items, 'cabin').map((item) => item.id), ['rear', 'cabin']);
  assert.deepEqual(itemsForZone(items, 'cargo_supplies').map((item) => item.id), ['cargo']);
  assert.deepEqual(itemsForZone(items, 'exterior_tires').map((item) => item.id), ['tires']);
});

test('PC submission enforces the same explicit answers and evidence as mobile', () => {
  const completeResults = Object.fromEntries(items.map((item) => [item.id, 'pass']));
  const base = {
    items,
    results: completeResults,
    photoCountByItem: {},
    mileage: '120500',
    hasOdometerPhoto: true,
    vehicleUsable: true,
  };

  assert.deepEqual(validateInspectionDraft({ ...base, results: {} }), { valid: false, reason: 'unanswered', itemId: 'front' });
  assert.deepEqual(validateInspectionDraft({
    ...base,
    results: { ...completeResults, cargo: 'fail' },
  }), { valid: false, reason: 'failure-photo', itemId: 'cargo' });
  assert.deepEqual(validateInspectionDraft({ ...base, mileage: '12.5' }), { valid: false, reason: 'mileage' });
  assert.deepEqual(validateInspectionDraft({ ...base, hasOdometerPhoto: false }), { valid: false, reason: 'odometer' });
  assert.deepEqual(validateInspectionDraft({ ...base, vehicleUsable: null }), { valid: false, reason: 'usable' });
  assert.deepEqual(validateInspectionDraft({
    ...base,
    results: { ...completeResults, cargo: 'fail' },
    photoCountByItem: { cargo: 1 },
  }), { valid: true });
});

test('Dashboard exposes a dedicated inspection route without a Pass All control', async () => {
  const [app, layout, page] = await Promise.all([
    readFile(new URL('../web/src/App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../web/src/components/Layout.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../web/src/pages/InspectionsPage.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(app, /path="inspections" element={<InspectionsPage \/>}/);
  assert.match(layout, /to="\/inspections"/);
  assert.doesNotMatch(page, /Pass All|pass all|allPass/);
  assert.match(page, /setActiveZone\(zone\)/);
});
