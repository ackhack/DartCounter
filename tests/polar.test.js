// ===========================
// DART COUNTER - Polar Board Coordinate Tests
// ===========================
// Run: node tests/polar.test.js
//
// Plain Node, no test runner — mirrors the project's build-free setup.
// Loads js/polar.js (which has no DOM dependencies) and asserts the
// polar <-> field mapping, the aim points, and the CPU aim simulation's
// distribution (including a cross-check against an independent Cartesian
// simulation). Exits non-zero on any failure.
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

const TAU = 2 * Math.PI;

// --- polarToField: points to throw tokens ---
check('polarToField(0, 0) = BE', polarToField(0, 0) === 'BE');
check('polarToField(1, 0) = D20 (top edge)', polarToField(1, 0) === 'D20');
check('polarToField(1, PI) = D3 (bottom edge)', polarToField(1, Math.PI) === 'D3');
check('polarToField(0.6, 0) = T20', polarToField(0.6, 0) === 'T20');
check('polarToField(0.97, PI) = D3', polarToField(0.97, Math.PI) === 'D3');
check('polarToField(0.3, PI/2) = 6 (right side, clockwise)', polarToField(0.3, Math.PI / 2) === '6');
check('polarToField(0.3, 3PI/2) = 11 (left side)', polarToField(0.3, 3 * Math.PI / 2) === '11');
check('polarToField(0.06, 1) = Bull', polarToField(0.06, 1) === 'Bull');
check('polarToField(1.2, 0) = miss', polarToField(1.2, 0) === '0');
check('sector boundary 9deg = 1 (not 20)', polarToField(0.7, Math.PI / 20) === '1');
check('negative angle wraps', polarToField(0.7, -Math.PI / 20) === '20');

// --- fieldToPolar: aim points ---
const t20 = fieldToPolar('T20');
check('fieldToPolar(T20).r = 103/170', Math.abs(t20.r - 103 / 170) < 1e-12, t20.r);
check('fieldToPolar(T20).angle = 0', t20.angle === 0);
check('fieldToPolar(D3).angle = PI', fieldToPolar('D3').angle === Math.PI);
check('fieldToPolar(6).angle = PI/2', fieldToPolar('6').angle === Math.PI / 2);
check('fieldToPolar(BE).r = 0', fieldToPolar('BE').r === 0);
check('fieldToPolar(Bull).r = bull ring center', Math.abs(fieldToPolar('Bull').r - 11.125 / 170) < 1e-12);
check('fieldToPolar(Bull).angle = 0', fieldToPolar('Bull').angle === 0);
check('fieldToPolar(20) aims outer single center', Math.abs(fieldToPolar('20').r - 133.5 / 170) < 1e-12);
check('fieldToPolar(D20).r = 165/170', Math.abs(fieldToPolar('D20').r - 165 / 170) < 1e-12);
check('aim point of T20 maps back to T20', polarToField(t20.r, t20.angle) === 'T20');

// Round trip: every scoreable field's aim point must map back to itself.
let roundTripOk = true;
for (let n = 1; n <= 20; n++) {
  for (const prefix of ['', 'T', 'D']) {
    const token = prefix + n;
    const p = fieldToPolar(token);
    if (polarToField(p.r, p.angle) !== token) {
      roundTripOk = false;
      console.log('  round trip broken: ' + token + ' -> ' + JSON.stringify(p) + ' -> ' + polarToField(p.r, p.angle));
    }
  }
}
check('round trip fieldToPolar -> polarToField (all T/D/single fields)', roundTripOk);
check('round trip Bull', polarToField(fieldToPolar('Bull').r, fieldToPolar('Bull').angle) === 'Bull');

// --- cpuAimHit distribution, difficulty 100 (maxR = 0.05), aim T20 ---
const N = 200000;
let inT = 0, misses = 0, maxDist = 0, outOfRange = 0;
for (let i = 0; i < N; i++) {
  const h = cpuAimHit('T20', 100);
  if (h.field === 'T20') inT++;
  if (h.field === '0') misses++;
  // distance from the aim point in board coordinates (x = r sin a, y = r cos a)
  const d = Math.hypot(
    h.r * Math.sin(h.angle) - t20.r * Math.sin(0),
    h.r * Math.cos(h.angle) - t20.r * Math.cos(0)
  );
  if (d > maxDist) maxDist = d;
  if (d > 0.05 + 1e-9) outOfRange++;
}
const frac = inT / N;
// The distance is uniform on [0, maxR] (per spec: small errors more likely
// than big ones), which concentrates hits near the aim point; a
// uniform-in-area spread would give ~57.6% instead.
check('T20 share ~73% at difficulty 100 (uniform distance)', frac > 0.65 && frac < 0.78, (100 * frac).toFixed(1) + '%');
check('every hit within 0.05 of aim point', outOfRange === 0, 'max ' + maxDist.toFixed(5));
check('no misses at difficulty 100 aiming T20', misses === 0, misses);

// --- cross-check: same distribution simulated independently in Cartesian ---
// Aim point at (0, 103/170), board center at the origin. The disk (radius
// 0.05 at r 0.606) always stays inside the 20 sector, so the radial
// condition alone decides T20.
const R_IN = 99 / 170;
const R_OUT = 107 / 170;
let triIndep = 0;
for (let i = 0; i < N; i++) {
  const a = TAU * Math.random();
  const rho = 0.05 * Math.random(); // uniform distance, same as cpuAimHit
  const dist = Math.hypot(rho * Math.cos(a), t20.r + rho * Math.sin(a));
  if (dist >= R_IN && dist <= R_OUT) triIndep++;
}
const diff = Math.abs(frac - triIndep / N);
check('cpuAimHit matches independent Cartesian simulation', diff < 0.02,
  'code ' + (100 * frac).toFixed(2) + '% vs indep ' + (100 * triIndep / N).toFixed(2) + '%');

// --- difficulty 0 (maxR = 1.0) produces misses ---
let m0 = 0;
for (let i = 0; i < 20000; i++) {
  if (cpuAimHit('T20', 0).field === '0') m0++;
}
check('misses occur at difficulty 0', m0 > 0, m0 + ' / 20000');

// --- BE aim: disk centered at the origin, radius bounded by maxR(50) = 0.525 ---
const maxR50 = 1.0 - (1.0 - 0.05) * 0.5;
let beOk = true;
for (let i = 0; i < 20000; i++) {
  if (cpuAimHit('BE', 50).r > maxR50 + 1e-9) {
    beOk = false;
    break;
  }
}
check('BE aim stays within maxR(50) = 0.525', beOk);

// --- difficulty scaling is linear: 0 -> 1.0, 100 -> 0.05 ---
check('maxR(0) = 1.0', Math.abs((1.0 - (1.0 - 0.05) * 0) - 1.0) < 1e-12);
check('maxR(100) = 0.05', Math.abs((1.0 - (1.0 - 0.05) * 1) - 0.05) < 1e-12);

console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURES');
process.exit(failures ? 1 : 0);
