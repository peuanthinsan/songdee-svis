import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('display dates use Gregorian years', async () => {
  const webFormatter = await readFile(new URL('../web/src/lib/format-date.ts', import.meta.url), 'utf8');
  const mobileFormatter = await readFile(new URL('../lib/format-date.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(webFormatter, /\+ 543/);
  assert.doesNotMatch(mobileFormatter, /\+ 543/);
});

test('issue responses can surface photos from the linked failed inspection', async () => {
  const listApi = await readFile(new URL('../api/issues.ts', import.meta.url), 'utf8');
  const detailApi = await readFile(new URL('../api/issues/[id].ts', import.meta.url), 'utf8');

  for (const source of [listApi, detailApi]) {
    assert.match(source, /CROSS JOIN LATERAL unnest\(ir\.photo_urls\)/);
    assert.match(source, /ir\.result = 'fail'/);
  }
});
