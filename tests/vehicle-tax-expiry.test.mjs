import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('vehicle tax expiry is wired through the dashboard and admin vehicle editor', async () => {
  const [dashboardApi, dashboardPage, adminApi, adminPage, migration] = await Promise.all([
    readFile(new URL('../api/dashboard.ts', import.meta.url), 'utf8'),
    readFile(new URL('../web/src/pages/DashboardPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../api/admin/vehicles/[id].ts', import.meta.url), 'utf8'),
    readFile(new URL('../web/src/pages/admin/VehiclesTab.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../sql/022-vehicle-tax-expiry.sql', import.meta.url), 'utf8'),
  ]);

  assert.match(migration, /ADD COLUMN IF NOT EXISTS tax_expiry_date DATE/);
  assert.match(dashboardApi, /tax_expiry_date/);
  assert.match(dashboardApi, /vehicleTax:/);
  assert.match(dashboardPage, /VehicleTaxSection/);
  assert.match(adminApi, /tax_expiry_date/);
  assert.match(adminPage, /taxExpiryDate/);
});
