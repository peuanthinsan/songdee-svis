import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const mobileChecklist = readFileSync('app/(app)/admin/checklist.tsx', 'utf8');
const webChecklist = readFileSync('web/src/pages/admin/ChecklistTab.tsx', 'utf8');
const webApi = readFileSync('web/src/api.ts', 'utf8');
const checklistApi = readFileSync('api/admin/checklist.ts', 'utf8');
const adminUserApi = readFileSync('api/admin/users/[id].ts', 'utf8');
const resetAdminScript = readFileSync('scripts/reset-admin-password.js', 'utf8');

function loadChecklistHandler(sqlCalls, rows) {
  const output = ts.transpileModule(checklistApi, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const sql = async (strings, ...values) => {
    sqlCalls.push({ text: strings.join('?'), values });
    return rows;
  };
  const fakeRequire = (specifier) => {
    if (specifier === '@neondatabase/serverless') return { neon: () => sql };
    if (specifier === '../../lib/admin-auth') {
      return { requireAdmin: async () => ({ companyId: 'company-1' }) };
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

test('checklist editors retrieve 501 rows in one stable snapshot', async () => {
  const rows = Array.from({ length: 501 }, (_, index) => ({ id: String(index + 1) }));
  const sqlCalls = [];
  const handler = loadChecklistHandler(sqlCalls, rows);
  const res = responseRecorder();

  await handler({ method: 'GET', query: { all: '1' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.length, 501);
  assert.equal(sqlCalls.length, 1);
  assert.ok(sqlCalls[0].values.includes(null), 'LIMIT NULL must request the full snapshot');
  assert.ok(sqlCalls[0].values.includes(0), 'full snapshots must start at offset zero');
  assert.match(checklistApi, /ORDER BY frequency, vehicle_type, sort_order, id/);
  assert.match(mobileChecklist, /&all=1/);
  assert.match(webApi, /new URLSearchParams\(\{ all: '1' \}\)/);
  assert.match(webChecklist, /vehicleTypeOverride \?\? \(filterType \|\| BLANK\.vehicleType\)/);
  assert.match(webChecklist, /frequencyOverride \?\? \(filterFreq \|\| BLANK\.frequency\)/);
  assert.match(webChecklist, /await load\(\)/);
});

test('legacy checklist pagination still defaults to a deterministic 500-row page', async () => {
  const sqlCalls = [];
  const handler = loadChecklistHandler(sqlCalls, []);
  const res = responseRecorder();

  await handler({ method: 'GET', query: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(sqlCalls.length, 1);
  assert.ok(sqlCalls[0].values.includes(500));
  assert.ok(sqlCalls[0].values.includes(0));
});

test('every admin password reset path uses the project bcrypt cost', () => {
  assert.match(adminUserApi, /bcrypt\.hash\(password, BCRYPT_ROUNDS\)/);
  assert.doesNotMatch(adminUserApi, /bcrypt\.hash\(password, 10\)/);
  assert.match(resetAdminScript, /const BCRYPT_ROUNDS = 12/);
  assert.match(resetAdminScript, /bcrypt\.hash\(newPassword, BCRYPT_ROUNDS\)/);
});
