// Test the isMeaningful guard from injected.js: empty objects and "nothing"
// (null / primitives / arrays) must be dropped; real throw objects kept.
// Run: node plugin/dartit-bridge/test/test-injected-guard.mjs
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../injected.js', import.meta.url), 'utf8');

const m = src.match(/function isMeaningful\([\s\S]*?\n  \}/);
if (!m) {
  console.error('could not extract isMeaningful');
  process.exit(1);
}
const isMeaningful = new Function(`return ${m[0]}`)();

const cases = [
  [{}, false, 'empty object dropped'],
  [null, false, 'null dropped'],
  [undefined, false, 'undefined dropped'],
  [0, false, 'number 0 dropped'],
  ['', false, 'empty string dropped'],
  ['str', false, 'string dropped'],
  [[], false, 'empty array dropped'],
  [[1, 2], false, 'array dropped'],
  [{ numbers: 11, fields: 'T' }, true, 'triple 11 kept'],
  [{ numbers: 0, fields: '0' }, true, 'miss kept (has keys)'],
  [{ numbers: 25, fields: 'B' }, true, 'bull kept'],
  [{ p_board_x: 1, p_board_y: 2 }, true, 'coords-only kept (SW will reject)'],
];

let failed = 0;
for (const [input, expected, label] of cases) {
  const got = isMeaningful(input);
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: got ${got}, expected ${expected}`);
}

process.exit(failed ? 1 : 0);
