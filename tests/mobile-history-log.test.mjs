import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../app/(app)/dashboard/index.tsx', import.meta.url), 'utf8');

test('mobile dashboard history shows both passed and failed inspections', () => {
  assert.doesNotMatch(source, /history\.inspections\s*\.filter\(\(ins\) => ins\.overall_status === 'fail'\)/);
  assert.match(source, /failed \? t\('inspection\.fail'\) : t\('inspection\.pass'\)/);
});
