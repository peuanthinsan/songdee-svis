import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  fleetIdsFromRows,
  resolveFleetScope,
  supportsFleetFilter,
} from '../web/src/fleet-filter.ts';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

const [
  app,
  context,
  selector,
  api,
  dashboard,
  inspections,
  issues,
  history,
  exportPage,
  checklistPage,
  adminPage,
] = await Promise.all([
  source('../web/src/App.tsx'),
  source('../web/src/FleetFilterContext.tsx'),
  source('../web/src/components/FleetFilterSelect.tsx'),
  source('../web/src/api.ts'),
  source('../web/src/pages/DashboardPage.tsx'),
  source('../web/src/pages/InspectionsPage.tsx'),
  source('../web/src/pages/IssuesPage.tsx'),
  source('../web/src/pages/HistoryPage.tsx'),
  source('../web/src/pages/ExportPage.tsx'),
  source('../web/src/pages/ChecklistPage.tsx'),
  source('../web/src/pages/AdminPage.tsx'),
]);

test('fleet selection is shared across operational dashboard routes', () => {
  assert.match(app, /<FleetFilterProvider><Layout \/><\/FleetFilterProvider>/);
  assert.match(context, /fetchAdminFleets\(\)/);
  assert.match(context, /resolveFleetScope\(isAdmin, user\?\.fleetId, selectedFleet\)/);
  assert.match(context, /selection\?\.companyId === companyId/);
  assert.match(selector, /user\?\.role !== 'admin'/);
  assert.match(selector, /<option value="">\{t\('allFleets'\)\}<\/option>/);
});

test('route eligibility, exact fleet identities, and role scope are preserved', () => {
  for (const pathname of ['/', '/inspections', '/issues', '/history']) {
    assert.equal(supportsFleetFilter(pathname), true);
  }
  assert.equal(supportsFleetFilter('/issues/'), true);
  for (const pathname of ['/export', '/checklist', '/admin', '/login', '/unknown']) {
    assert.equal(supportsFleetFilter(pathname), false);
  }

  const fleetIds = fleetIdsFromRows([
    { fleet_id: ' FLEET-A ' },
    { fleet_id: 'FLEET-A' },
    { fleet_id: ' FLEET-A ' },
    { fleet_id: '' },
  ]);
  assert.equal(fleetIds.length, 2);
  assert.ok(fleetIds.includes(' FLEET-A '));
  assert.ok(fleetIds.includes('FLEET-A'));

  assert.equal(resolveFleetScope(true, 'ASSIGNED', 'SELECTED'), 'SELECTED');
  assert.equal(resolveFleetScope(true, 'ASSIGNED', undefined), undefined);
  assert.equal(resolveFleetScope(false, 'ASSIGNED', 'SELECTED'), 'ASSIGNED');
  assert.equal(resolveFleetScope(false, '', 'SELECTED'), undefined);
});

test('eligible pages show the shared selector while exclusions remain independent', () => {
  for (const page of [dashboard, inspections, issues, history]) {
    assert.match(page, /<FleetFilterSelect \/>/);
    assert.match(page, /useFleetFilter\(\)/);
  }

  for (const page of [exportPage, checklistPage, adminPage]) {
    assert.doesNotMatch(page, /FleetFilterSelect|useFleetFilter/);
  }
  assert.match(exportPage, /id="export-fleet"/);
});

test('every eligible data load receives the effective fleet scope', () => {
  assert.match(dashboard, /fetchDashboard\(fleetScope, controller\.signal\)/);
  assert.match(dashboard, /fetchMaintenance\(fleetScope, controller\.signal\)/);
  assert.match(issues, /fetchIssues\(status \|\| undefined, fleetScope\)/);
  assert.equal(history.match(/fetchHistory\(startDate, endDate, fleetScope/g)?.length, 2);
  assert.match(inspections, /fleetId: fleetScope/);
  assert.match(inspections, /\[fleetScope, reloadKey\]/);
  assert.match(inspections, /setVehicles\(\[\]\)/);
  assert.match(inspections, /setSavedInspections\(\[\]\)/);
  assert.match(inspections, /!savedLoading && savedInspections\.map/);
  assert.match(issues, /setSelected\(null\)/);
  assert.match(history, /setSelected\(null\)/);
  assert.match(history, /setHistory\(null\)/);
  assert.match(history, /loadGenerationRef\.current === generation\) setLoadingMore\(false\)/);
});

test('inspection vehicle requests serialize the fleet query parameter', () => {
  assert.match(api, /fleetId\?: string;/);
  assert.match(api, /if \(params\?\.fleetId\) qs\.set\('fleetId', params\.fleetId\)/);
});
