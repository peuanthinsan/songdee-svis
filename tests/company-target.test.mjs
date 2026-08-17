import assert from 'node:assert/strict';
import test from 'node:test';

// scripts/lib/company-target.js is CommonJS. Node's ESM loader uses
// cjs-module-lexer to statically detect named exports from a top-level
// `module.exports = { a, b, c }` object literal, so the named-import form
// below should resolve directly. If that ever stops working (e.g. the
// export shape changes to something the lexer can't analyze), fall back to
// importing the default and destructuring it instead — this file is the
// proof of whichever form actually works.
import { selectCompanySlug, resolveCompany, DEFAULT_COMPANY_SLUG } from '../scripts/lib/company-target.js';

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
  assert.match(logs[0], /Note: SVIS_COMPANY_SLUG="dhl" ignored; --company=acme takes precedence\./);
});

test('--company=acme, env=dhl, write: proceeds with acme/flag + ignore-note', () => {
  const { result, threw, logs } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=acme'], env: { SVIS_COMPANY_SLUG: 'dhl' }, dryRun: false })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'acme', source: 'flag' });
  assert.equal(logs.length, 1);
  assert.match(logs[0], /Note: SVIS_COMPANY_SLUG="dhl" ignored; --company=acme takes precedence\./);
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
  assert.match(logs[0], /Note: SVIS_COMPANY_SLUG="acme" ignored; --company=dhl takes precedence\./);
});

test('--company=dhl, env=acme, write: proceeds with dhl/flag + ignore-note', () => {
  const { result, threw, logs } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=dhl'], env: { SVIS_COMPANY_SLUG: 'acme' }, dryRun: false })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'dhl', source: 'flag' });
  assert.equal(logs.length, 1);
  assert.match(logs[0], /Note: SVIS_COMPANY_SLUG="acme" ignored; --company=dhl takes precedence\./);
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
  assert.match(error.message, /--company was given more than once \("a", "b"\); tenant selection is/);
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

// ── FIX 1: repeated --company=<value>, identical vs differing values ───

test('--company=dhl --company=dhl (repeated flag, SAME value) refuses with the same-value message, not "ambiguous"', () => {
  const { error, threw } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=dhl', '--company=dhl'], env: {}, dryRun: false })
  );
  assert.equal(threw, true);
  assert.match(error.message, /given more than once with the same value/);
  assert.match(error.message, /\("dhl", "dhl"\)/);
});

test('--company=a --company=b (repeated flag, DIFFERING values) still refuses with the original ambiguous message (regression guard)', () => {
  const { error, threw } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=a', '--company=b'], env: {}, dryRun: false })
  );
  assert.equal(threw, true);
  assert.match(error.message, /--company was given more than once \("a", "b"\); tenant selection is/);
  assert.match(error.message, /ambiguous/);
});

// ── FIX 2: bare --company co-occurring with --company=<value> ─────────

test('--company --company=dhl (bare + valued) refuses with the bare/valued ambiguity message, not the M1 fallback claim', () => {
  const { error, threw } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company', '--company=dhl'], env: {}, dryRun: false })
  );
  assert.equal(threw, true);
  assert.match(error.message, /--company was given both without a value and as --company="dhl"; tenant/);
  assert.match(error.message, /ambiguous/);
  assert.doesNotMatch(error.message, /silently fall back/);
});

test('bare --company alone (no valued token) still refuses with the ORIGINAL M1 message (regression guard)', () => {
  const { error, threw } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company'], env: {}, dryRun: false })
  );
  assert.equal(threw, true);
  assert.match(error.message, /--company requires a value in the form --company=<slug>/);
  assert.match(error.message, /A bare --company would silently fall back to the ambient tenant/);
});

test('--company --company=a --company=b (bare + two differing values): reports bare\\/valued ambiguity, NOT the repeat message (ordering proof)', () => {
  const { error, threw } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company', '--company=a', '--company=b'], env: {}, dryRun: false })
  );
  assert.equal(threw, true);
  assert.match(error.message, /--company was given both without a value and as --company="a", "b"; tenant/);
  assert.doesNotMatch(error.message, /given more than once \(/);
  assert.doesNotMatch(error.message, /given more than once with the same value/);
});

// ── FIX 3: env value printed raw (untrimmed, JSON-quoted), not trimmed ─

test('env="  acme  " (padded), no flag, write: M5 shows the RAW quoted env value and the resolved trimmed company', () => {
  const { error, threw } = captureLogs(() =>
    selectCompanySlug({ argv: BASE_ARGV, env: { SVIS_COMPANY_SLUG: '  acme  ' }, dryRun: false })
  );
  assert.equal(threw, true);
  assert.match(error.message, /Refusing to write with a tenant taken from the environment/);
  assert.match(error.message, /SVIS_COMPANY_SLUG="  acme  " would have selected company "acme" without the/);
});

test('env="  acme  " (padded), no flag, dry-run: still proceeds with trimmed slug acme, source env (regression guard: trimming unchanged)', () => {
  const { result, threw } = captureLogs(() =>
    selectCompanySlug({ argv: BASE_ARGV, env: { SVIS_COMPANY_SLUG: '  acme  ' }, dryRun: true })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'acme', source: 'env' });
});

test('--company=acme, env="  dhl  " (padded, differs after trim): ignore-note shows the RAW quoted env value', () => {
  const { result, threw, logs } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=acme'], env: { SVIS_COMPANY_SLUG: '  dhl  ' }, dryRun: true })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'acme', source: 'flag' });
  assert.equal(logs.length, 1);
  assert.match(logs[0], /Note: SVIS_COMPANY_SLUG="  dhl  " ignored; --company=acme takes precedence\./);
});

// ── FIX 4: unrecognized option keys throw, instead of being silently dropped ─

test('selectCompanySlug({ slug: "acme" }) throws the slug-specific message naming selectCompanySlug', () => {
  const { error, threw } = captureLogs(() => selectCompanySlug({ slug: 'acme' }));
  assert.equal(threw, true);
  assert.match(error.message, /^selectCompanySlug no longer accepts a `slug` option\./);
  assert.match(error.message, /Pass the tenant as --company=<slug> in argv instead\./);
});

test('resolveCompany(sql, { slug: "acme" }) throws the slug-specific message naming resolveCompany, and never calls sql', async () => {
  const calls = [];
  const fakeSql = (...args) => {
    calls.push(args);
    throw new Error('sql must not be invoked when option validation should have thrown first');
  };

  await assert.rejects(
    () => resolveCompany(fakeSql, { slug: 'acme' }),
    (error) => {
      assert.match(error.message, /^resolveCompany no longer accepts a `slug` option\./);
      assert.match(error.message, /Pass the tenant as --company=<slug> in argv instead\./);
      return true;
    }
  );
  assert.deepEqual(calls, [], 'sql must never be called once slug-option validation has thrown');
});

test('selectCompanySlug({ compnay: "x" }) throws a generic unknown-option message listing that key', () => {
  const { error, threw } = captureLogs(() => selectCompanySlug({ compnay: 'x' }));
  assert.equal(threw, true);
  assert.match(error.message, /^selectCompanySlug received unknown option\(s\): compnay\./);
  assert.match(error.message, /Accepted options: argv, env, dryRun\./);
});

test('selectCompanySlug({ compnay: "x", zzz: 1, argv: BASE_ARGV }) lists multiple unknown keys, sorted and deterministic', () => {
  const { error, threw } = captureLogs(() => selectCompanySlug({ zzz: 1, compnay: 'x', argv: BASE_ARGV }));
  assert.equal(threw, true);
  assert.match(error.message, /received unknown option\(s\): compnay, zzz\./);
});

test('selectCompanySlug({ argv, env, dryRun }) — all documented options still accepted (regression guard)', () => {
  const { result, threw } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=acme'], env: { SVIS_COMPANY_SLUG: 'acme' }, dryRun: true })
  );
  assert.equal(threw, false);
  assert.deepEqual(result, { slug: 'acme', source: 'flag' });
});

// ── FIX A/B/C/D: every operator-supplied value in a refusal message is
//    rendered with JSON.stringify, so padding/quotes/newlines stay visible
//    instead of being silently reformatted ─────────────────────────────

test('--company --company="  dhl  " (bare + valued, padded raw value): message shows the padding, not a trimmed/reformatted value', () => {
  const { error, threw } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company', '--company=  dhl  '], env: {}, dryRun: false })
  );
  assert.equal(threw, true);
  assert.match(error.message, /--company was given both without a value and as --company="  dhl  "; tenant/);
});

test('--company --company=a --company=b (bare + two differing values): message lists BOTH raw values, quoted, in argv order', () => {
  const { error, threw } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company', '--company=a', '--company=b'], env: {}, dryRun: false })
  );
  assert.equal(threw, true);
  assert.match(error.message, /--company was given both without a value and as --company="a", "b"; tenant/);
});

test('--company=dhl --company=" dhl " (same tenant after trim, differing raw): same-value message shows BOTH raw values quoted, padding visible', () => {
  const { error, threw } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=dhl', '--company= dhl '], env: {}, dryRun: false })
  );
  assert.equal(threw, true);
  assert.match(error.message, /given more than once with the same value/);
  assert.match(error.message, /\("dhl", " dhl "\)/);
});

test('--company= --company= (both empty): same-value message renders two quoted empty strings, not an empty ()', () => {
  const { error, threw } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=', '--company='], env: {}, dryRun: false })
  );
  assert.equal(threw, true);
  assert.match(error.message, /given more than once with the same value/);
  assert.match(error.message, /\("", ""\)/);
});

test('--company=a,b --company=c (differing values, one containing a comma): each value is quoted so the list is unambiguous', () => {
  const { error, threw } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=a,b', '--company=c'], env: {}, dryRun: false })
  );
  assert.equal(threw, true);
  assert.match(error.message, /--company was given more than once \("a,b", "c"\); tenant selection is/);
});

test('--company=a b (internal whitespace): whitespace message still renders "a b" (regression guard for FIX D switching to JSON.stringify)', () => {
  const { error, threw } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, '--company=a b'], env: {}, dryRun: false })
  );
  assert.equal(threw, true);
  assert.match(error.message, /contains whitespace/);
  assert.match(error.message, /"a b"/);
});

test('--company=<value> containing a double quote and whitespace escapes safely (JSON.stringify, not hand-written quoting)', () => {
  const rawValue = 'a" b';
  const { error, threw } = captureLogs(() =>
    selectCompanySlug({ argv: [...BASE_ARGV, `--company=${rawValue}`], env: {}, dryRun: false })
  );
  assert.equal(threw, true);
  assert.match(error.message, /contains whitespace/);
  assert.ok(
    error.message.includes(JSON.stringify(rawValue)),
    'message should contain the JSON.stringify-escaped raw value, quote escaped as \\"'
  );
});

test('generic unknown-option message still reads "Accepted options: argv, env, dryRun." after FIX E derives it from allowedKeys (regression guard)', () => {
  const { error, threw } = captureLogs(() => selectCompanySlug({ notAnOption: true }));
  assert.equal(threw, true);
  assert.match(error.message, /Accepted options: argv, env, dryRun\.$/);
});
