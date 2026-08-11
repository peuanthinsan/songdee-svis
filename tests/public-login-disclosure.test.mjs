import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const rosterSource = readFileSync(new URL('../api/auth/users-list.ts', import.meta.url), 'utf8');
const loginApiSource = readFileSync(new URL('../api/auth/login.ts', import.meta.url), 'utf8');
const mobileLoginSource = readFileSync(new URL('../app/(auth)/login.tsx', import.meta.url), 'utf8');
const webLoginSource = readFileSync(new URL('../web/src/pages/LoginPage.tsx', import.meta.url), 'utf8');
const webApiSource = readFileSync(new URL('../web/src/api.ts', import.meta.url), 'utf8');

function responseRecorder() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: undefined,
    headers,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('the retired public roster route cannot enumerate login accounts', async () => {
  const { default: handler } = await import('../api/auth/users-list.ts');
  const res = responseRecorder();

  await handler({ method: 'GET', query: { company: 'dhl' } }, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'Not found' });
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.doesNotMatch(rosterSource, /\bFROM\s+users\b/i);
  assert.doesNotMatch(rosterSource, /driverAccounts|staffAccounts|first_name|last_name/);
});

test('mobile and web login accept a typed username without requesting a roster', () => {
  assert.doesNotMatch(mobileLoginSource, /\/api\/auth\/users-list/);
  assert.match(mobileLoginSource, /placeholder=\{t\('login\.username'\)\}/);
  assert.match(mobileLoginSource, /value=\{username\}/);
  assert.match(mobileLoginSource, /onChangeText=\{setUsername\}/);
  assert.match(mobileLoginSource, /signIn\(username\.trim\(\), password, selectedCompanySlug\)/);

  assert.doesNotMatch(webLoginSource, /fetchLoginUsers|LoginAccount/);
  assert.match(webLoginSource, /autoComplete="username"/);
  assert.match(webLoginSource, /value=\{username\}/);
  assert.match(webLoginSource, /signIn\(username\.trim\(\), password, companySlug\)/);

  assert.doesNotMatch(webApiSource, /fetchLoginUsers|LoginAccount|\/api\/auth\/users-list/);
});

test('the credential endpoint still accepts username, password, and company', () => {
  assert.match(loginApiSource, /req\.method !== 'POST'/);
  assert.match(loginApiSource, /\{ username, password, companySlug = 'dhl' \}/);
  assert.match(loginApiSource, /u\.username = \$\{loginUsername\}/);
  assert.match(loginApiSource, /bcrypt\.compare\(password, user\.password_hash\)/);
  assert.match(loginApiSource, /res\.status\(200\)\.json\(/);
});
