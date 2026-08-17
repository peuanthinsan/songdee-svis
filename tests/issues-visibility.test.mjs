import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('issues API prioritizes recently refreshed issue reports', async () => {
  const source = await readFile(new URL('../api/issues.ts', import.meta.url), 'utf8');
  const orderings = source.match(/ORDER BY ir\.updated_at DESC NULLS LAST, ir\.created_at DESC/g) ?? [];

  // The API has one query for each supported status/fleet/search combination.
  assert.equal(orderings.length, 8);
  assert.doesNotMatch(source, /ORDER BY ir\.created_at DESC LIMIT/);
});
