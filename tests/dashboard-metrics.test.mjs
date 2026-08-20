import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dashboard = await readFile(new URL('../api/dashboard.ts', import.meta.url), 'utf8');
const analytics = await readFile(new URL('../api/admin/analytics.ts', import.meta.url), 'utf8');

test('dashboard inspection numerators exclude inactive vehicles', () => {
  const dailyQuery = dashboard.match(/Vehicles with today's daily[\s\S]*?SELECT DISTINCT i\.vehicle_id[\s\S]*?\n      `,/);
  const weeklyQuery = dashboard.match(/Vehicles with a weekly inspection[\s\S]*?SELECT DISTINCT i\.vehicle_id[\s\S]*?\n      `,/);

  assert.ok(dailyQuery?.[0].includes('AND v.is_active'));
  assert.ok(weeklyQuery?.[0].includes('AND v.is_active'));
});

test('dashboard issue and defect counts exclude inactive vehicles', () => {
  const issueQuery = dashboard.match(/Vehicles with a defect = distinct vehicles[\s\S]*?\n      `,/);
  const defectQuery = dashboard.match(/Defect vehicle list[\s\S]*?\n      `,/);

  assert.ok(issueQuery?.[0].includes('vm.is_active'));
  assert.ok(defectQuery?.[0].includes('vm.is_active'));
});

test('admin analytics uses active vehicles for trend denominators and numerator joins', () => {
  assert.match(analytics, /FROM vehicle_master\n      WHERE company_id = \$\{admin\.companyId\} AND is_active/);
  assert.match(analytics, /JOIN vehicle_master vm ON vm\.id = il\.vehicle_id AND vm\.is_active/);
});
