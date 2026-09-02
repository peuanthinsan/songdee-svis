import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const dashboard = await readFile(new URL('../api/dashboard.ts', import.meta.url), 'utf8');
const analytics = await readFile(new URL('../api/admin/analytics.ts', import.meta.url), 'utf8');

function loadDashboardHandler(sql) {
  const output = ts.transpileModule(dashboard, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const fakeRequire = (specifier) => {
    if (specifier === '@neondatabase/serverless') return { neon: () => sql };
    if (specifier === '../lib/api-auth') {
      return {
        verifyAuth: async () => ({
          companyId: 'company-1',
          fleetId: 'GDR',
          role: 'supervisor',
          userId: 'user-1',
          username: 'supervisor',
        }),
      };
    }
    if (specifier === '../lib/thai-date') {
      return {
        getTodayThai: () => '2026-09-02',
        getMondayOfWeekThai: () => '2026-08-31',
      };
    }
    if (specifier === '../lib/unit-status-sheet') {
      return {
        fetchSheetVehicles: async () => [
          { plateNumber: '68-7043', gpsStatus: 'offline' },
          { plateNumber: '68-7070', gpsStatus: 'offline' },
        ],
        recordVehicleActivity: async () => {},
      };
    }
    throw new Error(`Unexpected import in test: ${specifier}`);
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'process', output)(
    fakeRequire,
    module,
    module.exports,
    process,
  );
  return module.exports.default;
}

function responseRecorder() {
  return {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

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

test('dashboard issue counts qualify created_at after joining vehicle data', () => {
  const issueQuery = dashboard.match(/Vehicles with a defect = distinct vehicles[\s\S]*?\n      `,/);

  assert.ok(issueQuery?.[0].includes('ir.created_at AT TIME ZONE'));
  assert.ok(!issueQuery?.[0].includes('WHERE (created_at AT TIME ZONE'));
});

test('inspection completion circles do not depend on current GPS activity', async () => {
  const sql = async (strings) => {
    const query = strings.join('?');
    if (query.includes('SELECT id, plate_number, vehicle_type, fleet_id, tax_expiry_date')) {
      return [
        { id: 'vehicle-1', plate_number: '68-7043', vehicle_type: 'car', fleet_id: 'GDR', tax_expiry_date: null },
        { id: 'vehicle-2', plate_number: '68-7070', vehicle_type: 'van', fleet_id: 'GDR', tax_expiry_date: null },
      ];
    }
    if (query.includes('SELECT DISTINCT i.vehicle_id, i.frequency')) {
      return [
        { vehicle_id: 'vehicle-1', frequency: 'daily', vehicle_type: 'car' },
        { vehicle_id: 'vehicle-1', frequency: 'post_route', vehicle_type: 'car' },
      ];
    }
    if (query.includes("WHERE i.frequency = 'weekly'")) {
      return [{ vehicle_id: 'vehicle-1', vehicle_type: 'car' }];
    }
    if (query.includes('COUNT(*) FILTER (WHERE NOT vehicle_usable)')) return [{ total: 0, today: 0 }];
    if (query.includes('COUNT(DISTINCT vehicle_id)::int AS total')) return [{ total: 0, today: 0 }];
    if (query.includes('SELECT ir.id AS issue_id')) return [];
    if (query.includes('SELECT fleet_id, COUNT(*)::int AS total')) {
      return [{ fleet_id: 'GDR', total: 2 }];
    }
    if (query.includes('SELECT v.fleet_id, COUNT(DISTINCT i.vehicle_id)::int AS checked')) {
      return [{ fleet_id: 'GDR', checked: 1 }];
    }
    throw new Error(`Unexpected SQL in test: ${query}`);
  };
  const handler = loadDashboardHandler(sql);
  const res = responseRecorder();

  await handler({ method: 'GET', query: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(
    {
      active: [res.body.active.checked, res.body.active.total],
      preRoute: [res.body.preDeparture.checked, res.body.preDeparture.total],
      postRoute: [res.body.postRoute.checked, res.body.postRoute.total],
      weekly: [res.body.weekly.checked, res.body.weekly.total],
    },
    {
      active: [0, 2],
      preRoute: [1, 2],
      postRoute: [1, 2],
      weekly: [1, 2],
    },
  );
});

test('admin analytics uses active vehicles for trend denominators and numerator joins', () => {
  assert.match(analytics, /FROM vehicle_master\n      WHERE company_id = \$\{admin\.companyId\} AND is_active/);
  assert.match(analytics, /JOIN vehicle_master vm ON vm\.id = il\.vehicle_id AND vm\.is_active/);
});
