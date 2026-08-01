import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACCOUNT_IP_LIMIT,
  ACCOUNT_LIMIT,
  IP_LIMIT,
  isLoginRateLimited,
  normalizedLoginIdentity,
  privateLoginHash,
  requestIp,
} from '../lib/login-rate-limit.ts';

test('requestIp prefers the Vercel-owned forwarding header', () => {
  assert.equal(
    requestIp({
      'x-vercel-forwarded-for': '203.0.113.9',
      'x-forwarded-for': '198.51.100.5',
      'x-real-ip': '192.0.2.7',
    }),
    '203.0.113.9',
  );
});

test('requestIp handles arrays, proxy lists, fallbacks, and missing headers', () => {
  assert.equal(requestIp({ 'x-forwarded-for': ['203.0.113.8, 10.0.0.1'] }), '203.0.113.8');
  assert.equal(requestIp({ 'x-real-ip': '192.0.2.2' }), '192.0.2.2');
  assert.equal(requestIp({}), 'unknown');
});

test('login identities normalize case and surrounding whitespace', () => {
  assert.equal(normalizedLoginIdentity(' DHL ', ' Driver.One '), 'dhl:driver.one');
});

test('private hashes are deterministic, domain-separated, and secret-specific', () => {
  const first = privateLoginHash('dhl:driver.one', 'secret-a');
  assert.equal(first, privateLoginHash('dhl:driver.one', 'secret-a'));
  assert.notEqual(first, privateLoginHash('dhl:driver.one', 'secret-b'));
  assert.notEqual(first, privateLoginHash('driver.one', 'secret-a'));
  assert.match(first, /^[a-f0-9]{64}$/);
});

test('each configured threshold blocks at its boundary', () => {
  const below = {
    accountIpFailures: ACCOUNT_IP_LIMIT - 1,
    ipFailures: IP_LIMIT - 1,
    accountFailures: ACCOUNT_LIMIT - 1,
  };
  assert.equal(isLoginRateLimited(below), false);
  assert.equal(isLoginRateLimited({ ...below, accountIpFailures: ACCOUNT_IP_LIMIT }), true);
  assert.equal(isLoginRateLimited({ ...below, ipFailures: IP_LIMIT }), true);
  assert.equal(isLoginRateLimited({ ...below, accountFailures: ACCOUNT_LIMIT }), true);
});
