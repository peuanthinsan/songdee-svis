import assert from 'node:assert/strict';
import test from 'node:test';

// scripts/lib/company-target.js is CommonJS. Node's ESM loader uses
// cjs-module-lexer to statically detect named exports from a top-level
// `module.exports = { a, b, c }` object literal, so the named-import form
// below should resolve directly. If that ever stops working (e.g. the
// export shape changes to something the lexer can't analyze), fall back to
// importing the default and destructuring it instead — this file is the
// proof of whichever form actually works.
import { selectCompanySlug, DEFAULT_COMPANY_SLUG } from '../scripts/lib/company-target.js';

assert.equal(typeof selectCompanySlug, 'function', 'named import of selectCompanySlug failed to resolve via cjs-module-lexer');
assert.equal(DEFAULT_COMPANY_SLUG, 'dhl');

const BASE_ARGV = ['node', 'script.js'];

/** Runs fn with console.log captured, returning both its result/thrown-error and the captured lines. */
function captureLogs(fn) {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    const result = fn();
    return { result, logs, threw: false };
  } catch (error) {
    return { error, logs, threw: true };
  } finally {
    console.log = originalLog;
  }
}

// ── No flag ────────────────────────────────────────────────────────────

test('no flag, env unset, dry-run: proceeds with dhl/default', () => {
  const { result, threw, logs } = captureLogs(() =>
    selectCompanySlug({ argv: BASE_ARGV, env: {}, dryRun: true })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'dhl', source: 'default' });
  assert.deepEqual(logs, []);
});

test('no flag, env unset, write: proceeds with dhl/default', () => {
  const { result, threw } = captureLogs(() =>
    selectCompanySlug({ argv: BASE_ARGV, env: {}, dryRun: false })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'dhl', source: 'default' });
});

test('no flag, env=dhl, dry-run: proceeds with dhl/env', () => {
  const { result, threw } = captureLogs(() =>
    selectCompanySlug({ argv: BASE_ARGV, env: { SVIS_COMPANY_SLUG: 'dhl' }, dryRun: true })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'dhl', source: 'env' });
});

test('no flag, env=dhl, write: refuses (M5)', () => {
  const { error, threw } = captureLogs(() =>
    selectCompanySlug({ argv: BASE_ARGV, env: { SVIS_COMPANY_SLUG: 'dhl' }, dryRun: false })
  );
  assert.equal(threw, true);
  assert.match(error.message, /Refusing to write with a tenant taken from the environment/);
});

test('no flag, env=acme, dry-run: proceeds with acme/env', () => {
  const { result, threw } = captureLogs(() =>
    selectCompanySlug({ argv: BASE_ARGV, env: { SVIS_COMPANY_SLUG: 'acme' }, dryRun: true })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'acme', source: 'env' });
});

test('no flag, env=acme, write: refuses (M5)', () => {
  const { error, threw } = captureLogs(() =>
    selectCompanySlug({ argv: BASE_ARGV, env: { SVIS_COMPANY_SLUG: 'acme' }, dryRun: false })
  );
  assert.equal(threw, true);
  assert.match(error.message, /Refusing to write with a tenant taken from the environment/);
});

test('no flag, env="", dry-run: refuses (M4)', () => {
  const { error, threw } = captureLogs(() =>
    selectCompanySlug({ argv: BASE_ARGV, env: { SVIS_COMPANY_SLUG: '' }, dryRun: true })
  );
  assert.equal(threw, true);
  assert.match(error.message, /SVIS_COMPANY_SLUG is set but empty/);
});

test('no flag, env="", write: refuses (M4)', () => {
  const { error, threw } = captureLogs(() =>
    selectCompanySlug({ argv: BASE_ARGV, env: { SVIS_COMPANY_SLUG: '' }, dryRun: false })
  );
  assert.equal(threw, true);
  assert.match(error.message, /SVIS_COMPANY_SLUG is set but empty/);
});

// ── --company=acme ────────────────────────────────────────────────────

test('--company=acme, env unset, dry-run: proceeds with acme/flag', () => {
  const { result, threw, logs } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=acme'], env: {}, dryRun: true })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'acme', source: 'flag' });
  assert.deepEqual(logs, []);
});

test('--company=acme, env unset, write: proceeds with acme/flag', () => {
  const { result, threw } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=acme'], env: {}, dryRun: false })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'acme', source: 'flag' });
});

test('--company=acme, env=dhl, dry-run: proceeds with acme/flag + ignore-note', () => {
  const { result, threw, logs } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=acme'], env: { SVIS_COMPANY_SLUG: 'dhl' }, dryRun: true })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'acme', source: 'flag' });
  assert.equal(logs.length, 1);
  assert.match(logs[0], /Note: SVIS_COMPANY_SLUG=dhl ignored; --company=acme takes precedence\./);
});

test('--company=acme, env=dhl, write: proceeds with acme/flag + ignore-note', () => {
  const { result, threw, logs } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=acme'], env: { SVIS_COMPANY_SLUG: 'dhl' }, dryRun: false })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'acme', source: 'flag' });
  assert.equal(logs.length, 1);
  assert.match(logs[0], /Note: SVIS_COMPANY_SLUG=dhl ignored; --company=acme takes precedence\./);
});

test('--company=acme, env=acme, dry-run: proceeds with acme/flag, NO note (env equals flag)', () => {
  const { result, threw, logs } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=acme'], env: { SVIS_COMPANY_SLUG: 'acme' }, dryRun: true })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'acme', source: 'flag' });
  assert.deepEqual(logs, []);
});

test('--company=acme, env=acme, write: proceeds with acme/flag, NO note (env equals flag)', () => {
  const { result, threw, logs } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=acme'], env: { SVIS_COMPANY_SLUG: 'acme' }, dryRun: false })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'acme', source: 'flag' });
  assert.deepEqual(logs, []);
});

test('--company=acme, env="", dry-run: proceeds with acme/flag + empty-env note', () => {
  const { result, threw, logs } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=acme'], env: { SVIS_COMPANY_SLUG: '' }, dryRun: true })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'acme', source: 'flag' });
  assert.equal(logs.length, 1);
  assert.match(logs[0], /Note: empty SVIS_COMPANY_SLUG ignored; --company=acme takes precedence\./);
});

test('--company=acme, env="", write: proceeds with acme/flag + empty-env note', () => {
  const { result, threw, logs } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=acme'], env: { SVIS_COMPANY_SLUG: '' }, dryRun: false })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'acme', source: 'flag' });
  assert.equal(logs.length, 1);
  assert.match(logs[0], /Note: empty SVIS_COMPANY_SLUG ignored; --company=acme takes precedence\./);
});

// ── --company=dhl ─────────────────────────────────────────────────────

test('--company=dhl, env unset, dry-run: proceeds with dhl/flag', () => {
  const { result, threw } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=dhl'], env: {}, dryRun: true })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'dhl', source: 'flag' });
});

test('--company=dhl, env unset, write: proceeds with dhl/flag', () => {
  const { result, threw } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=dhl'], env: {}, dryRun: false })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'dhl', source: 'flag' });
});

test('--company=dhl, env=dhl, dry-run: proceeds with dhl/flag, NO note (env equals flag)', () => {
  const { result, threw, logs } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=dhl'], env: { SVIS_COMPANY_SLUG: 'dhl' }, dryRun: true })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'dhl', source: 'flag' });
  assert.deepEqual(logs, []);
});

test('--company=dhl, env=dhl, write: proceeds with dhl/flag, NO note (env equals flag)', () => {
  const { result, threw, logs } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=dhl'], env: { SVIS_COMPANY_SLUG: 'dhl' }, dryRun: false })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'dhl', source: 'flag' });
  assert.deepEqual(logs, []);
});

test('--company=dhl, env=acme, dry-run: proceeds with dhl/flag + ignore-note', () => {
  const { result, threw, logs } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=dhl'], env: { SVIS_COMPANY_SLUG: 'acme' }, dryRun: true })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'dhl', source: 'flag' });
  assert.equal(logs.length, 1);
  assert.match(logs[0], /Note: SVIS_COMPANY_SLUG=acme ignored; --company=dhl takes precedence\./);
});

test('--company=dhl, env=acme, write: proceeds with dhl/flag + ignore-note', () => {
  const { result, threw, logs } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=dhl'], env: { SVIS_COMPANY_SLUG: 'acme' }, dryRun: false })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'dhl', source: 'flag' });
  assert.equal(logs.length, 1);
  assert.match(logs[0], /Note: SVIS_COMPANY_SLUG=acme ignored; --company=dhl takes precedence\./);
});

test('--company=dhl, env="", dry-run: proceeds with dhl/flag + empty-env note', () => {
  const { result, threw, logs } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=dhl'], env: { SVIS_COMPANY_SLUG: '' }, dryRun: true })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'dhl', source: 'flag' });
  assert.equal(logs.length, 1);
  assert.match(logs[0], /Note: empty SVIS_COMPANY_SLUG ignored; --company=dhl takes precedence\./);
});

test('--company=dhl, env="", write: proceeds with dhl/flag + empty-env note', () => {
  const { result, threw, logs } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=dhl'], env: { SVIS_COMPANY_SLUG: '' }, dryRun: false })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'dhl', source: 'flag' });
  assert.equal(logs.length, 1);
  assert.match(logs[0], /Note: empty SVIS_COMPANY_SLUG ignored; --company=dhl takes precedence\./);
});

// ── Malformed flag forms ─────────────────────────────────────────────

test('bare --company refuses regardless of env or dry-run (M1)', () => {
  for (const env of [{}, { SVIS_COMPANY_SLUG: 'acme' }, { SVIS_COMPANY_SLUG: '' }]) {
    for (const dryRun of [true, false]) {
      const { error, threw } = captureLogs(() =>
        selectCompanySlug({ argv: [...BASE_ARGV, '--company'], env, dryRun })
      );
      assert.equal(threw, true);
      assert.match(error.message, /--company requires a value in the form --company=<slug>/);
    }
  }
});

test('--company= (empty value) refuses (M2)', () => {
  const { error, threw } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company='], env: {}, dryRun: false })
  );
  assert.equal(threw, true);
  assert.match(error.message, /--company= has an empty value; refusing to guess the tenant/);
});

test('--company="   " (whitespace-only value) refuses (M2)', () => {
  const { error, threw } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=   '], env: {}, dryRun: true })
  );
  assert.equal(threw, true);
  assert.match(error.message, /--company= has an empty value; refusing to guess the tenant/);
});

test('--company=a b (internal whitespace) refuses with the whitespace message, not the empty one', () => {
  const { error, threw } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=a b'], env: {}, dryRun: false })
  );
  assert.equal(threw, true);
  assert.match(error.message, /contains whitespace/);
  assert.match(error.message, /"a b"/);
  assert.doesNotMatch(error.message, /empty value/);
});

test('--company=  a  b   (internal whitespace, padded) refuses, interpolating the raw untrimmed value', () => {
  const { error, threw } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=  a  b  '], env: {}, dryRun: false })
  );
  assert.equal(threw, true);
  assert.match(error.message, /contains whitespace/);
  assert.match(error.message, /"  a  b  "/);
  assert.doesNotMatch(error.message, /empty value/);
});

test('--company=a --company=b (repeated flag) refuses (M3), never last-wins', () => {
  const { error, threw } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=a', '--company=b'], env: {}, dryRun: false })
  );
  assert.equal(threw, true);
  assert.match(error.message, /--company was given more than once \(a, b\); tenant selection is/);
});

// ── Unclaimed lookalike token ────────────────────────────────────────

test('--companyfoo=x is NOT claimed as --company; behaves as flag-absent (dhl/default)', () => {
  const { result, threw } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--companyfoo=x'], env: {}, dryRun: false })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'dhl', source: 'default' });
});

test('--companyfoo=x with env=acme on a write still refuses (M5), because the flag was not claimed', () => {
  const { error, threw } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--companyfoo=x'], env: { SVIS_COMPANY_SLUG: 'acme' }, dryRun: false })
  );
  assert.equal(threw, true);
  assert.match(error.message, /Refusing to write with a tenant taken from the environment/);
});
