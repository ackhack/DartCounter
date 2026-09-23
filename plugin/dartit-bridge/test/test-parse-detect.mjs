// Functional test: load parseDetect out of service-worker.js and exercise it,
// then confirm each token round-trips through applyThrowToken (js/input.js)
// into the shape submitScore expects. Run: node plugin/dartit-bridge/test/test-parse-detect.mjs
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);

const swSrc = readFileSync(new URL('service-worker.js', root), 'utf8');
const m = swSrc.match(/function parseDetect[\s\S]*?\n}/);
if (!m) {
  console.error('could not extract parseDetect');
  process.exit(1);
}
const parseDetect = new Function(`return ${m[0]}`)();

const cases = [
  // [input, expected, label]
  [{ numbers: 11, fields: 'T' }, 'T11', 'sample from plan: triple 11'],
  [{ numbers: 20, fields: 'T' }, 'T20', 'triple 20'],
  [{ numbers: 16, fields: 'D' }, 'D16', 'double 16'],
  [{ numbers: 5, fields: 'S' }, '5', 'single 5 (S)'],
  [{ numbers: 5, fields: '' }, '5', 'single 5 (empty fields)'],
  [{ numbers: 5, fields: null }, '5', 'single 5 (null fields)'],
  [{ numbers: 5 }, '5', 'single 5 (no fields key)'],
  [{ numbers: 25, fields: 'B' }, 'Bull', 'bull via fields B'],
  [{ numbers: 25, fields: 'S' }, 'Bull', 'bull via numbers 25'],
  [{ numbers: 25, fields: 'D' }, 'BE', 'bulleye via numbers 25'],
  [{ numbers: 25, fields: 'BE' }, 'BE', 'bullseye'],
  [{ numbers: 25, fields: 'BULLSEYE' }, 'BE', 'bullseye spelled out'],
  [{ numbers: 0, fields: '0' }, '0', 'miss'],
  [{ numbers: 0, fields: 'M' }, '0', 'miss M'],
  [{ numbers: 0, fields: 'MISS' }, '0', 'miss MISS'],
  [{ numbers: 21, fields: 'T' }, null, 'out of range number ignored'],
  [{ numbers: 0, fields: 'T' }, '0', 'miss wins over T (num 0)'],
  [{ numbers: 14, fields: 't' }, 'T14', 'lowercase fields tolerated (t = triple)'],
  [null, null, 'null payload'],
  [{}, null, 'empty object'],
];

let failed = 0;
for (const [input, expected, label] of cases) {
  const got = parseDetect(input);
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
}

// Round-trip: tokens must be consumable by applyThrowToken logic (js/input.js).
// applyThrowToken mutates the `input` in its closure; we bind it to a fresh object.
const inputSrc = readFileSync(new URL('js/input.js', root), 'utf8');
const am = inputSrc.match(/function applyThrowToken[\s\S]*?\n}/);
const makeApplicator = new Function(
  'input',
  'token',
  `const f = ${am[0]}; f(token); return input;`
);

const tokenCases = [
  ['T11', { number: 11, multiplier: 3, special: null }],
  ['D16', { number: 16, multiplier: 2, special: null }],
  ['5', { number: 5, multiplier: 1, special: null }],
  ['Bull', { number: null, multiplier: 1, special: 'bull' }],
  ['BE', { number: null, multiplier: 1, special: 'bulleye' }],
  ['0', { number: null, multiplier: 1, special: '0' }],
];
for (const [token, expected] of tokenCases) {
  const input = { number: null, multiplier: 1, special: null, selected: false };
  const got = makeApplicator(input, token);
  const ok =
    got.number === expected.number &&
    got.multiplier === expected.multiplier &&
    got.special === expected.special;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  token ${token} -> ${JSON.stringify(got)}`);
}

process.exit(failed ? 1 : 0);
