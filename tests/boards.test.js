// ===========================
// DART COUNTER - End Screen Board Tests
// ===========================
// Run: node tests/boards.test.js
//
// Plain Node, no test runner — mirrors the project's build-free setup.
// Loads js/polar.js (which has no DOM dependencies) and asserts the
// dot-position math, the per-player dart aggregation (recorded hit
// coordinates win; manual input falls back to field aim points; bust
// auto-miss fillers are never counted), the per-ideal color scheme, and the
// zone-disk math (one disk per ideal throw, reaching its farthest dart).
// Exits non-zero on any failure.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

vm.runInThisContext(
  fs.readFileSync(path.join(__dirname, '..', 'js', 'polar.js'), 'utf8'),
  { filename: 'polar.js' }
);

let failures = 0;
function check(name, cond, extra) {
  if (cond) {
    console.log('ok:   ' + name);
  } else {
    failures++;
    console.log('FAIL: ' + name + (extra !== undefined ? '  [' + extra + ']' : ''));
  }
}

// --- DARTBOARD_PLAYABLE_FRACTION / boardDotPosition ---
check('playable fraction is 0.9 (gen_dartboard.py: 540px / 600px)', DARTBOARD_PLAYABLE_FRACTION === 0.9);

const pCenter = boardDotPosition(0, 0);
check('r = 0 (bulls-eye) sits at the image center', pCenter.left === 50 && pCenter.top === 50);

const pTop = boardDotPosition(0.6, 0);
check('angle 0 (20 sector) is above center, on the vertical axis',
  Math.abs(pTop.left - 50) < 1e-9 && Math.abs(pTop.top - (50 - 45 * 0.6)) < 1e-9, pTop.top);

const pRight = boardDotPosition(0.3, Math.PI / 2);
check('angle PI/2 (6 sector) is right of center, on the horizontal axis',
  Math.abs(pRight.top - 50) < 1e-9 && Math.abs(pRight.left - (50 + 45 * 0.3)) < 1e-9, pRight.left);

const pBottom = boardDotPosition(1, Math.PI);
check('r = 1, angle PI (D3 edge) lands at the bottom of the playable area',
  Math.abs(pBottom.left - 50) < 1e-9 && Math.abs(pBottom.top - 95) < 1e-9, pBottom.top);

// A recorded T20 aim point must map back onto the board's 20 sector.
const t20Aim = fieldToPolar('T20');
check('T20 aim point maps back to T20 through the same geometry',
  polarToField(t20Aim.r, t20Aim.angle) === 'T20');

// --- collectBoardDarts ---
// CPU-style turns: every thrown dart carries a hit entry, the bust
// auto-miss filler ('MISS') does not, and a thrown miss still records
// an entry with r > 1.
const cpuBustTurn = {
  playerId: 0,
  throws: ['T20', 'D20 (BUST)', 'MISS'],
  hits: [
    { r: 0.6, angle: 0, field: 'T20', ideal: 'T20' },
    { r: 0.9, angle: 0.2, field: 'D20', ideal: 'D20' }
  ]
};
const cpuMissTurn = {
  playerId: 0,
  throws: ['20', 'Miss', 'T19'],
  hits: [
    { r: 0.7, angle: 0.5, field: '20' },
    { r: 1.3, angle: 1.1, field: '0' },
    { r: 0.6, angle: 0.3, field: 'T19' }
  ]
};
// Human turn: no hits recorded at all — fall back to field aim points.
const humanTurn = {
  playerId: 1,
  throws: ['20', 'Miss', 'T20']
};
const allTurns = [cpuBustTurn, cpuMissTurn, humanTurn];

const p0 = collectBoardDarts(allTurns, 0);
check('CPU: 5 darts counted (auto-miss filler excluded)', p0.darts === 5, p0.darts);
check('CPU: 4 dots on the board', p0.dots.length === 4, p0.dots.length);
check('CPU: 1 miss (the r > 1 entry)', p0.misses === 1, p0.misses);
check('CPU: first dot uses the recorded coordinates, not the aim point',
  Math.abs(p0.dots[0].r - 0.6) < 1e-12 && p0.dots[0].angle === 0);
check('CPU: hit cursor stays aligned across the bust filler',
  Math.abs(p0.dots[1].r - 0.9) < 1e-12 && Math.abs(p0.dots[1].angle - 0.2) < 1e-12);
check('CPU: the thrown miss consumes its entry and adds no dot',
  Math.abs(p0.dots[2].r - 0.7) < 1e-12 && Math.abs(p0.dots[2].angle - 0.5) < 1e-12);
check('CPU: third turn keeps using recorded coordinates',
  Math.abs(p0.dots[3].r - 0.6) < 1e-12 && Math.abs(p0.dots[3].angle - 0.3) < 1e-12);

const p1 = collectBoardDarts(allTurns, 1);
check('human: 3 darts, 2 dots, 1 miss', p1.darts === 3 && p1.dots.length === 2 && p1.misses === 1,
  JSON.stringify(p1));
const aim20 = fieldToPolar('20');
const aimT20 = fieldToPolar('T20');
check('human: single 20 falls back to the field aim point',
  Math.abs(p1.dots[0].r - aim20.r) < 1e-12 && p1.dots[0].angle === aim20.angle);
check('human: T20 falls back to the field aim point',
  Math.abs(p1.dots[1].r - aimT20.r) < 1e-12 && p1.dots[1].angle === aimT20.angle);

check('other players are not mixed in', collectBoardDarts(allTurns, 2).darts === 0);
check('missing turns entries are tolerated',
  collectBoardDarts([null, { playerId: 0, throws: [] }], 0).darts === 0);

// --- ideal tracking (the key for dot/zone colors) ---
check('CPU: dot ideal is the recorded aim', p0.dots[0].ideal === 'T20');
check('bridge-style: recorded hit without an aim falls back to the scored field',
  p0.dots[2].ideal === '20');
check('human: manual darts are ideal to the field they scored',
  p1.dots[0].ideal === '20' && p1.dots[1].ideal === 'T20');
check('CPU: dot ideal is the recorded aim even when the dart lands elsewhere', (() => {
  const t = { playerId: 0, throws: ['T20'], hits: [{ r: 0.97, angle: 0.05, field: 'D20', ideal: 'T20' }] };
  const d = collectBoardDarts([t], 0).dots;
  return d.length === 1 && d[0].ideal === 'T20' && Math.abs(d[0].r - 0.97) < 1e-12;
})());

// Bull / bulls-eye labels fall back to their aim points too.
const bullTurn = { playerId: 1, throws: ['Bull', 'BE'] };
const pBull = collectBoardDarts([bullTurn], 1);
check('human: Bull and BE fall back to their aim points',
  pBull.dots.length === 2 &&
  Math.abs(pBull.dots[0].r - fieldToPolar('Bull').r) < 1e-12 &&
  pBull.dots[1].r === 0);
check('human: Bull and BE are ideal to their own fields',
  pBull.dots[0].ideal === 'Bull' && pBull.dots[1].ideal === 'BE');

// --- fieldColor ---
check('fieldColor: pinned format (single 20 is the hue-0 mid step)',
  fieldColor('20') === 'hsl(0, 75%, 58%)');
check('fieldColor: all 20 sector singles get distinct colors',
  new Set(DARTBOARD_ORDER.map((n) => fieldColor(String(n)))).size === 20);
check('fieldColor: one sector reads as a three-step ramp (D/S/T distinct)',
  fieldColor('D20') !== fieldColor('20') &&
  fieldColor('20') !== fieldColor('T20') &&
  fieldColor('D20') !== fieldColor('T20'));
check('fieldColor: adjacent sectors are distinct too',
  fieldColor('T20') !== fieldColor('T1') && fieldColor('T1') !== fieldColor('T18'));
check('fieldColor: bull and bulls-eye are distinct from each other',
  fieldColor('Bull') !== fieldColor('BE'));
check('fieldColor: case-insensitive', fieldColor('t20') === fieldColor('T20'));
check('fieldColor: alpha variant is hsla with that alpha', (() => {
  const c = fieldColor('T20', 0.18);
  return c.indexOf('hsla(') === 0 && c.indexOf(', 0.18)') !== -1;
})());

// --- boardZones ---
check('boardZones: no dots -> no zones', boardZones([]).length === 0);

const t20Group = [
  { r: aimT20.r, angle: aimT20.angle, ideal: 'T20' }, // on the aim point
  { r: 0.55, angle: 0.12, ideal: 'T20' },             // short of the aim
  { r: 0.97, angle: 0, ideal: 'T20' }                 // overshot into the double
];
const d20Group = [{ r: fieldToPolar('D20').r, angle: 0, ideal: 'D20' }];
const zs = boardZones(t20Group.concat(d20Group));
check('boardZones: one zone per ideal field, first-seen order',
  zs.length === 2 && zs[0].ideal === 'T20' && zs[1].ideal === 'D20');

const zT20 = zs[0];
check('boardZones: zone is centered on the ideal aim point',
  Math.abs(zT20.r - aimT20.r) < 1e-12 && Math.abs(zT20.angle - aimT20.angle) < 1e-12);
let maxDist = 0;
t20Group.forEach((d) => {
  maxDist = Math.max(maxDist, Math.hypot(
    d.r * Math.sin(d.angle) - aimT20.r * Math.sin(aimT20.angle),
    d.r * Math.cos(d.angle) - aimT20.r * Math.cos(aimT20.angle)
  ));
});
check('boardZones: radius reaches the farthest dart of the group plus padding',
  Math.abs(zT20.radius - (maxDist + BOARD_ZONE_PADDING)) < 1e-12,
  zT20.radius + ' vs ' + (maxDist + BOARD_ZONE_PADDING));
check('boardZones: lone dart on the aim point gets just the padding radius',
  Math.abs(zs[1].radius - BOARD_ZONE_PADDING) < 1e-12);

console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURES');
process.exit(failures ? 1 : 0);
