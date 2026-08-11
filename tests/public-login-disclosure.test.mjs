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

test('the login roster returns active users by company', () => {
  assert.match(rosterSource, /FROM users u/i);
  assert.match(rosterSource, /u\.is_active/);
  assert.match(rosterSource, /driverAccounts|staffAccounts/);
  assert.match(rosterSource, /c\.slug = \$\{companySlug\}/);
});

test('mobile and web login request and use the roster', () => {
  assert.match(mobileLoginSource, /\/api\/auth\/users-list/);
  assert.match(mobileLoginSource, /setDriverNames/);
  assert.match(mobileLoginSource, /setStaffNames/);
  assert.match(mobileLoginSource, /signIn\(identifier, password, selectedCompanySlug\)/);

  assert.match(webLoginSource, /fetchLoginUsers|LoginAccount/);
  assert.match(webLoginSource, /accounts\.map/);
  assert.match(webLoginSource, /signIn\(username\.trim\(\), password, companySlug\)/);

  assert.match(webApiSource, /fetchLoginUsers|LoginAccount|\/api\/auth\/users-list/);
});

test('the credential endpoint still accepts username, password, and company', () => {
  assert.match(loginApiSource, /req\.method !== 'POST'/);
  assert.match(loginApiSource, /\{ username, password, companySlug = 'dhl' \}/);
  assert.match(loginApiSource, /u\.username = \$\{loginUsername\}/);
  assert.match(loginApiSource, /bcrypt\.compare\(password, user\.password_hash\)/);
  assert.match(loginApiSource, /res\.status\(200\)\.json\(/);
});
