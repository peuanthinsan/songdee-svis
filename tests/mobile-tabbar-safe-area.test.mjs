import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('mobile tab bar reserves the Android system navigation inset', async () => {
  const source = await readFile(new URL('../app/(app)/_layout.tsx', import.meta.url), 'utf8');
  assert.match(source, /useSafeAreaInsets/);
  assert.match(source, /height:\s*density\.tabBarHeight\s*\+\s*insets\.bottom/);
  assert.match(source, /paddingBottom:\s*10\s*\+\s*insets\.bottom/);
});
