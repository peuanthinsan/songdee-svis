/**
 * Company (tenant) target guard.
 *
 * Exists because migration 019 made `users` and `vehicle_master` unique per
 * (company_id, ...), not globally. A seed script that does not name its
 * company will either fail its ON CONFLICT target or, worse, sweep another
 * tenant's rows inactive. Resolving by slug rather than hardcoding DHL's
 * UUID keeps the scripts correct for tenants whose ids are generated at
 * insert time.
 *
 * The tenant guard exists for the same reason as scripts/lib/db-target.js:
 * an ambient value can name the WRONG target while everything downstream
 * prints confident success. There, it was DATABASE_URL sourced from a stale
 * .env.local (2026-07-25: a migration and a 359-vehicle import landed in a
 * decommissioned database, and the verification queries read the same wrong
 * file). Here, the ambient value is SVIS_COMPANY_SLUG: a stale
 * `export SVIS_COMPANY_SLUG=acme` left in a shell, combined with
 * `node scripts/seed-db.js --confirm` intended for DHL, scopes every
 * statement to acme and deactivates every acme vehicle/user absent from the
 * DHL data file. Right mechanism, wrong target, confident output.
 *
 * Invariant: the environment never selects the tenant for a WRITE — a write
 * takes its tenant only from an explicit --company=<slug> on the command
 * line, or the in-code default; SVIS_COMPANY_SLUG may steer a --dry-run
 * (which writes nothing) but never a write, not even when its value happens
 * to equal the default, because a carve-out for that case would teach
 * operators that the environment variable is a supported way to select a
 * write target.
 */
const DEFAULT_COMPANY_SLUG = 'dhl';

const COMPANY_FLAG_PREFIX = '--company=';

const SELECT_COMPANY_SLUG_OPTIONS = ['argv', 'env', 'dryRun'];
const RESOLVE_COMPANY_OPTIONS = ['argv', 'env', 'dryRun'];

/**
 * Reject any option key an `opts` object was not documented to accept.
 * Exists because the module used to accept a `slug` override that bypassed
 * source validation (a caller could select a tenant without naming it on the
 * command line); deleting that parameter without also rejecting it would
 * leave a stale caller silently falling through to default/env semantics —
 * a silent wrong-tenant path, which is exactly what this module exists to
 * prevent. `slug` gets a message naming it specifically since it is the
 * likely mistake; any other unrecognized key gets a generic message.
 *
 * @param {string} functionName name to attribute the error to (its own, not a callee's)
 * @param {object} opts the raw options object as received, before defaulting
 * @param {string[]} allowedKeys keys that function is documented to accept
 */
function assertKnownOptions(functionName, opts, allowedKeys) {
  const unknownKeys = Object.keys(opts).filter((key) => !allowedKeys.includes(key));
  if (unknownKeys.length === 0) return;

  if (unknownKeys.includes('slug')) {
    throw new Error(
      `${functionName} no longer accepts a \`slug\` option. It was removed because it\n` +
      'bypassed source validation, letting a caller select a tenant without naming it\n' +
      'on the command line. Pass the tenant as --company=<slug> in argv instead.'
    );
  }

  throw new Error(
    `${functionName} received unknown option(s): ${unknownKeys.slice().sort().join(', ')}.\n` +
    `Accepted options: ${allowedKeys.join(', ')}.`
  );
}

/**
 * Parse the tenant slug a script is allowed to use, given how it was invoked.
 * Pure and synchronous so it is unit-testable without a database or a child
 * process; refusals are thrown Errors, not process.exit, so a caller's
 * top-level `.catch(error => ...)` produces the message directly.
 *
 * @param {object} [opts]
 * @param {string[]} [opts.argv] defaults to process.argv
 * @param {NodeJS.ProcessEnv} [opts.env] defaults to process.env
 * @param {boolean} [opts.dryRun] true when the script performs no writes
 * @returns {{ slug: string, source: 'flag' | 'env' | 'default' }}
 */
function selectCompanySlug(opts = {}) {
  assertKnownOptions('selectCompanySlug', opts, SELECT_COMPANY_SLUG_OPTIONS);
  const { argv = process.argv, env = process.env, dryRun = false } = opts;

  const companyTokens = argv.filter((token) => token === '--company' || token.startsWith(COMPANY_FLAG_PREFIX));

  const hasBareFlag = companyTokens.some((token) => token === '--company');
  const valueTokens = companyTokens.filter((token) => token.startsWith(COMPANY_FLAG_PREFIX));

  // A bare --company alongside one or more --company=<value> tokens is not
  // the "silently falls back to the ambient tenant" case M1 warns about — a
  // value token is present, so no fallback would occur. It is still
  // ambiguous (which token wins?), so still refuse, but with a message that
  // names the condition that actually fired. This check must run before the
  // bare-alone check and the repeated-value check below, so this exact
  // combination is never misreported as either of those.
  if (hasBareFlag && valueTokens.length > 0) {
    const rawValues = valueTokens.map((token) => token.slice(COMPANY_FLAG_PREFIX.length));
    const quotedList = rawValues.map((value) => JSON.stringify(value)).join(', ');
    throw new Error(
      `--company was given both without a value and as --company=${quotedList}; tenant\n` +
      'selection is ambiguous. Re-run with exactly one --company=<slug>.'
    );
  }

  if (hasBareFlag) {
    throw new Error(
      '--company requires a value in the form --company=<slug> (no space form).\n' +
      'A bare --company would silently fall back to the ambient tenant, which is\n' +
      'exactly the failure this guard exists to prevent.\n' +
      'Re-run with --company=<slug>, e.g. --company=dhl.'
    );
  }

  if (valueTokens.length > 1) {
    const rawValues = valueTokens.map((token) => token.slice(COMPANY_FLAG_PREFIX.length));
    const trimmedValues = rawValues.map((value) => value.trim());
    const allSameValue = trimmedValues.every((value) => value === trimmedValues[0]);

    // Identical repeated values are not ambiguous — there is only one
    // candidate tenant — but a repeated flag still means a hand-edited
    // command line, so keep refusing (conservative is right) while naming
    // the condition that actually fired instead of claiming ambiguity.
    if (allSameValue) {
      const quotedRawValues = rawValues.map((value) => JSON.stringify(value)).join(', ');
      throw new Error(
        `--company was given more than once with the same value (${quotedRawValues}).\n` +
        'Remove the duplicate and re-run with exactly one --company=<slug>.'
      );
    }

    const quotedRawValues = rawValues.map((value) => JSON.stringify(value)).join(', ');
    throw new Error(
      `--company was given more than once (${quotedRawValues}); tenant selection is\n` +
      'ambiguous. Re-run with exactly one --company=<slug>.'
    );
  }

  if (valueTokens.length === 1) {
    const rawValue = valueTokens[0].slice(COMPANY_FLAG_PREFIX.length);
    const trimmedValue = rawValue.trim();
    if (trimmedValue === '') {
      throw new Error(
        '--company= has an empty value; refusing to guess the tenant.\n' +
        'Re-run with --company=<slug>, e.g. --company=dhl.'
      );
    }
    if (/\s/.test(trimmedValue)) {
      throw new Error(
        `--company=<value> contains whitespace (${JSON.stringify(rawValue)}); a company slug cannot\n` +
        'contain spaces.\n' +
        'Re-run with --company=<slug>, e.g. --company=dhl.'
      );
    }

    const envValue = env.SVIS_COMPANY_SLUG;
    if (envValue !== undefined) {
      const envTrimmed = envValue.trim();
      if (envTrimmed === '') {
        console.log(`Note: empty SVIS_COMPANY_SLUG ignored; --company=${trimmedValue} takes precedence.`);
      } else if (envTrimmed !== trimmedValue) {
        console.log(`Note: SVIS_COMPANY_SLUG=${JSON.stringify(envValue)} ignored; --company=${trimmedValue} takes precedence.`);
      }
    }

    return { slug: trimmedValue, source: 'flag' };
  }

  // No --company token on the command line; the tenant can only come from
  // SVIS_COMPANY_SLUG or the in-code default.
  if (env.SVIS_COMPANY_SLUG === undefined) {
    return { slug: DEFAULT_COMPANY_SLUG, source: 'default' };
  }

  const envTrimmed = env.SVIS_COMPANY_SLUG.trim();
  if (envTrimmed === '') {
    throw new Error(
      'SVIS_COMPANY_SLUG is set but empty. An empty value usually means a shell\n' +
      'expansion produced nothing (e.g. export SVIS_COMPANY_SLUG=$TENANT with TENANT\n' +
      'unset), and falling back to "dhl" could target the wrong tenant with\n' +
      'confident output. Unset SVIS_COMPANY_SLUG or re-run with --company=<slug>.'
    );
  }

  if (dryRun) {
    return { slug: envTrimmed, source: 'env' };
  }

  throw new Error(
    'Refusing to write with a tenant taken from the environment.\n\n' +
    `SVIS_COMPANY_SLUG=${JSON.stringify(env.SVIS_COMPANY_SLUG)} would have selected company "${envTrimmed}" without the\n` +
    'tenant appearing anywhere on the command line. A stale exported variable is\n' +
    'how a sync deactivates every vehicle and user in the wrong tenant.\n\n' +
    'Name the tenant explicitly: re-run with --company=<slug> --confirm.\n' +
    '(--dry-run may still use SVIS_COMPANY_SLUG, because it writes nothing.)'
  );
}

/** Human-readable description of where a resolved slug came from, for the COMPANY banner. */
function describeSource(source) {
  if (source === 'flag') return '--company flag';
  if (source === 'env') return 'SVIS_COMPANY_SLUG (dry-run only)';
  return `default ('${DEFAULT_COMPANY_SLUG}')`;
}

/**
 * Resolve the tenant every write in a seed script must be scoped to.
 *
 * @param {(strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>} sql neon tagged-template client
 * @param {object} [opts]
 * @param {string[]} [opts.argv] defaults to process.argv
 * @param {NodeJS.ProcessEnv} [opts.env] defaults to process.env
 * @param {boolean} [opts.dryRun] true when the script performs no writes
 * @returns {Promise<{ id: string, slug: string, name: string }>}
 */
async function resolveCompany(sql, opts = {}) {
  assertKnownOptions('resolveCompany', opts, RESOLVE_COMPANY_OPTIONS);
  const { argv, env, dryRun = false } = opts;
  const { slug, source } = selectCompanySlug({ argv, env, dryRun });

  const rows = await sql`SELECT id, slug, name, is_active FROM companies WHERE slug = ${slug}`;

  if (rows.length === 0) {
    const activeRows = await sql`SELECT slug FROM companies WHERE is_active = true ORDER BY slug`;
    const available = activeRows.map((row) => row.slug).join(', ') || '(none)';
    throw new Error(
      `No company found with slug ${JSON.stringify(slug)}.\n` +
      `Available active company slugs: ${available}`
    );
  }

  const company = rows[0];
  if (!company.is_active) {
    throw new Error(`Company ${JSON.stringify(slug)} is not active; refusing to seed into a disabled tenant.`);
  }

  console.log('──────────────────────────────────────────────');
  console.log(`  COMPANY TARGET  : ${company.slug}`);
  console.log(`  name            : ${company.name}`);
  console.log(`  id              : ${company.id}`);
  console.log(`  selected via    : ${describeSource(source)}`);
  console.log('──────────────────────────────────────────────');

  return { id: company.id, slug: company.slug, name: company.name };
}

module.exports = { resolveCompany, selectCompanySlug, DEFAULT_COMPANY_SLUG };
