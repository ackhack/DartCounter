// ===========================
// DART COUNTER - Hit Persistence Tests
// ===========================
// Run: node tests/storage.test.js
//
// Plain Node, no test runner — mirrors the project's build-free setup.
// Stubs localStorage (in-memory) and state, then loads js/constants.js,
// js/cpu.js, js/polar.js, js/input.js (DEFAULT_PLAYER_AIM) and
// js/storage.js and asserts the per-mode hit persistence: updatePlayerStats
// appends the game's recorded landings (collectPlayerHits) to the right
// mode's hits list — other modes stay empty, misses (r > 1) are kept and
// counted in totalMisses, the in-progress turn is included on a manual
// mid-turn end, the list is capped at MAX_PERSISTED_HITS (most recent
// games win), and loadStats backfills hits/totalMisses on entries written
// before the hit stats existed.
// Exits non-zero on any failure.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// In-memory localStorage — storage.js touches it at call time only.
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};

['constants.js', 'cpu.js', 'polar.js', 'input.js', 'storage.js'].forEach((f) => {
  vm.runInThisContext(
    fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'),
    { filename: f }
  );
});

// The real app's state (js/state.js) has DOM dependencies; updatePlayerStats
// only reads mode, history and the in-progress turn.
let failures = 0;
function check(name, cond, extra) {
  if (cond) {
    console.log('ok:   ' + name);
  } else {
    failures++;
    console.log('FAIL: ' + name + (extra !== undefined ? '  [' + extra + ']' : ''));
  }
}

// --- X01 game: hits land in the x01 bucket, other modes stay empty ---
globalThis.state = {
  mode: 'x01',
  history: [{
    playerId: 0,
    throws: ['T20', 'D20', '20'],
    values: [[20, 3, 60], [20, 2, 40], [20, 1, 20]],
    total: 120,
    hits: [
      { r: 0.6, angle: 0, field: 'T20', ideal: 'T20' },
      { r: 0.9, angle: 0.2, field: 'D20', ideal: 'D20' },
      { r: 0.95, angle: 0.1, field: 'D20', ideal: '20' }
    ]
  }],
  _currentPlayerTurn: null
};
globalThis.stats = { players: {}, games: [] };

const alice = { id: 0, name: 'Alice', score: 0, runs: 120, turns: 3, finished: true };
updatePlayerStats(alice, true);

const x01 = stats.players['alice'].modes.x01;
check('x01: the game hits are persisted to the x01 bucket', x01.hits.length === 3, JSON.stringify(x01.hits));
check('x01: entries keep coordinates and the stamped ideal',
  x01.hits[0].r === 0.6 && x01.hits[0].angle === 0 && x01.hits[0].ideal === 'T20'
  && x01.hits[1].ideal === 'D20' && x01.hits[2].ideal === '20');
check('x01: other mode buckets stay empty',
  stats.players['alice'].modes.cricket.hits.length === 0
  && stats.players['alice'].modes.shanghai.hits.length === 0);
check('x01: totalMisses starts at 0 (no misses this game)', x01.totalMisses === 0);
check('saveStats: the hits ride into localStorage',
  JSON.parse(store[STORAGE_KEY_STATS]).players.alice.modes.x01.hits.length === 3);

// --- Cricket game: misses kept + counted, in-progress turn included ---
globalThis.state = {
  mode: 'cricket',
  history: [{
    playerId: 1,
    throws: ['T20', 'Miss', 'T19'],
    values: [[20, 3, 60], [0, 1, 0], [19, 3, 57]],
    total: 117,
    hits: [
      { r: 0.5, angle: 0.1, field: 'T20', ideal: 'T20' },
      { r: 1.3, angle: 1.1, field: '0', ideal: 'T20' },
      { r: 0.6, angle: 0.3, field: 'T19', ideal: 'T20' }
    ]
  }],
  _currentPlayerTurn: {
    playerId: 1,
    throws: ['T20'],
    values: [[20, 3, 60]],
    total: 60,
    hits: [{ r: 0.55, angle: 0.05, field: 'T20', ideal: 'T20' }]
  }
};
globalThis.stats = { players: {}, games: [] };

const bob = { id: 1, name: 'Bob', score: 0, runs: 177, turns: 4, finished: false, marks: {} };
updatePlayerStats(bob, false);

const cr = stats.players['bob'].modes.cricket;
check('cricket: hits land in the cricket bucket (4 darts, incl. in-progress turn)',
  cr.hits.length === 4, JSON.stringify(cr.hits));
check('cricket: the mid-turn in-progress turn is persisted', cr.hits[3].r === 0.55);
check('cricket: recorded misses (r > 1) stay in the log',
  cr.hits.filter(h => h.r > 1).length === 1);
check('cricket: totalMisses counts the thrown miss', cr.totalMisses === 1, cr.totalMisses);

// --- Cap: most recent games win ---
globalThis.state = {
  mode: 'x01',
  history: [{
    playerId: 0,
    throws: ['T20', 'T20', 'T20'],
    values: [[20, 3, 60], [20, 3, 60], [20, 3, 60]],
    total: 180,
    hits: [
      { r: 0.6, angle: 0, ideal: 'T20' },
      { r: 0.61, angle: 0, ideal: 'T20' },
      { r: 0.62, angle: 0, ideal: 'T20' }
    ]
  }],
  _currentPlayerTurn: null
};
globalThis.stats = {
  players: {
    alice: {
      name: 'Alice',
      modes: {
        x01: Object.assign(emptyModeStats(), {
          gamesPlayed: 10,
          hits: Array.from({ length: MAX_PERSISTED_HITS }, (_, i) => ({ r: 0.5, angle: i, ideal: 'T20' }))
        }),
        cricket: emptyModeStats(),
        shanghai: emptyModeStats()
      }
    }
  },
  games: []
};

const capPlayer = { id: 0, name: 'Alice', score: 0, runs: 180, turns: 3, finished: true };
updatePlayerStats(capPlayer, true);

const capped = stats.players['alice'].modes.x01;
check('cap: the hit list never grows past MAX_PERSISTED_HITS',
  capped.hits.length === MAX_PERSISTED_HITS, capped.hits.length);
check('cap: the most recent landings survive the trim',
  capped.hits.slice(-3).every((h, i) => Math.abs(h.r - (0.6 + i * 0.01)) < 1e-12));

// --- Migration: pre-hit-stat entries get empty defaults ---
store[STORAGE_KEY_STATS] = JSON.stringify({
  players: {
    legacy: {
      name: 'Legacy',
      modes: {
        x01: { gamesPlayed: 2, wins: 1 },
        cricket: { gamesPlayed: 0 },
        shanghai: { gamesPlayed: 0 }
      }
    }
  },
  games: []
});

const loaded = loadStats();
const legacyModes = Object.values(loaded.players['legacy'].modes);
check('loadStats: pre-hit-stat entries are backfilled with hits [] and totalMisses 0',
  legacyModes.every(m => Array.isArray(m.hits) && m.hits.length === 0 && m.totalMisses === 0),
  JSON.stringify(loaded.players['legacy'].modes));

console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURES');
process.exit(failures ? 1 : 0);
