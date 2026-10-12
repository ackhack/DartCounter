// ===========================
// DART COUNTER - Full Game Record Tests
// ===========================
// Run: node tests/storage.test.js
//
// Plain Node, no test runner — mirrors the project's build-free setup.
// Stubs localStorage (in-memory) and state, then loads js/constants.js,
// js/cpu.js, js/polar.js, js/input.js (DEFAULT_PLAYER_AIM) and
// js/storage.js and asserts the full-game persistence + derivation:
// saveGameToHistory stores a lean record (throw labels only, no
// values/_scoring; hits as { r, angle, ideal }; the in-progress turn
// included without a total), nothing per-player is persisted,
// derivePlayerStats recomputes every per-mode number the stats screen
// shows (mode attribution, games/wins, averages, best turn/score,
// checkout attempts+made, bull darts, 180s/T20s, best leg, instant
// wins, counting hits incl. T=3/D=2/S=1 weighting and off-target
// exclusion, hits/misses counting incl. r > 1 and manual 'Miss' vs
// 'MISS' filler, CPU + 'Player N' exclusion, pre-full-record summary
// games skipped), and loadStats drops old per-player aggregates while
// keeping the old summary games.
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

let failures = 0;
function check(name, cond, extra) {
  if (cond) {
    console.log('ok:   ' + name);
  } else {
    failures++;
    console.log('FAIL: ' + name + (extra !== undefined ? '  [' + extra + ']' : ''));
  }
}

// --- loadStats: old per-player aggregates are dropped, games kept ---
store[STORAGE_KEY_STATS] = JSON.stringify({
  players: {
    alice: { name: 'Alice', modes: { x01: { gamesPlayed: 5 } } }
  },
  games: [{
    date: 1, mode: 'x01', x01Start: 301,
    players: [{ name: 'Alice', finished: true, runs: 500 }],
    winner: 'Alice', results: []
  }]
});
globalThis.stats = loadStats();
check('loadStats: old `players` aggregates are dropped', !('players' in stats));
check('loadStats: old summary games are kept', stats.games.length === 1 && stats.games[0].winner === 'Alice');

store[STORAGE_KEY_STATS] = '{ not json';
check('loadStats: corrupt JSON -> fresh defaults',
  JSON.stringify(loadStats()) === JSON.stringify({ games: [] }));

// --- saveGameToHistory: the lean full record ---
store[STORAGE_KEY_STATS] = JSON.stringify({ games: [] });
globalThis.stats = loadStats();

globalThis.state = {
  mode: 'x01',
  x01Start: 301,
  players: [
    { id: 0, name: 'Alice', score: 0, runs: 401, turns: 9, finished: true, marks: {} },
    { id: 1, name: 'Bob', score: 6, runs: 295, turns: 7, finished: false, marks: {} },
    { id: 2, name: 'CPU', score: 201, runs: 100, turns: 3, finished: false, marks: {}, isCpu: true },
    { id: 3, name: 'Player 1', score: 201, runs: 100, turns: 3, finished: false, marks: {} }
  ],
  history: [
    { // Alice t1 — three recorded landings, one a miss (r > 1)
      round: 1, playerId: 0, name: 'Alice', color: '#60a5fa',
      throws: ['T20', 'T20', 'T20'], values: [[20, 3, 60], [20, 3, 60], [20, 3, 60]],
      _scoring: [0, 0, 0], startingScore: 301, startingRuns: 0, shanghaiIndex: 0, total: 180,
      hits: [
        { r: 0.98, angle: 0.1, field: 'T20', ideal: 'T20' },
        { r: 1.02, angle: 0.5, field: null, ideal: 'T20' },
        { r: 0.9, angle: 0.2, field: 'T20', ideal: 'T20' }
      ]
    },
    { // Alice t2 — manual input: two whiffs, no recorded landings
      round: 2, playerId: 0, name: 'Alice', color: '#60a5fa',
      throws: ['Miss', 'Miss', '20'], values: [[0, 1, 0], [0, 1, 0], [20, 1, 20]],
      _scoring: [0, 0, 0], startingScore: 121, startingRuns: 180, shanghaiIndex: 0, total: 20
    },
    { // Alice t3 — checkout, finishes
      round: 3, playerId: 0, name: 'Alice', color: '#60a5fa',
      throws: ['T20', 'D20', '1'], values: [[20, 3, 60], [20, 2, 40], [1, 1, 1]],
      _scoring: [0, 0, 0], startingScore: 101, startingRuns: 200, shanghaiIndex: 0, total: 101
    },
    { // Bob t1
      round: 1, playerId: 1, name: 'Bob', color: '#4ade80',
      throws: ['T20', 'T20', 'D20'], values: [[20, 3, 60], [20, 3, 60], [20, 2, 40]],
      _scoring: [0, 0, 0], startingScore: 301, startingRuns: 0, shanghaiIndex: 0, total: 160
    },
    { // Bob t2 — manual: one whiff, BE, Bull
      round: 2, playerId: 1, name: 'Bob', color: '#4ade80',
      throws: ['Miss', 'BE', 'Bull'], values: [[0, 1, 0], [25, 2, 50], [25, 1, 25]],
      _scoring: [0, 0, 0], startingScore: 141, startingRuns: 160, shanghaiIndex: 0, total: 75
    },
    { // CPU t1 — recorded landings, second dart a miss
      round: 1, playerId: 2, name: 'CPU', color: '#facc15',
      throws: ['T20', 'Miss', 'D20'], values: [[20, 3, 60], [0, 1, 0], [20, 2, 40]],
      _scoring: [0, 0, 0], startingScore: 301, startingRuns: 0, shanghaiIndex: 0, total: 100,
      hits: [
        { r: 0.95, angle: 0.05, field: 'T20', ideal: 'T20' },
        { r: 1.4, angle: 1.1, field: null, ideal: 'T20' },
        { r: 0.85, angle: 0.3, field: 'D20', ideal: 'D20' }
      ]
    },
    { // Player 1 t1 — anonymous name, must get no derived entry
      round: 1, playerId: 3, name: 'Player 1', color: '#f87171',
      throws: ['T20', '20', '20'], values: [[20, 3, 60], [20, 1, 20], [20, 1, 20]],
      _scoring: [0, 0, 0], startingScore: 301, startingRuns: 0, shanghaiIndex: 0, total: 100
    }
  ],
  _currentPlayerTurn: {
    // Bob's in-progress turn — manual End mid-turn: one dart, no total.
    round: 3, playerId: 1, name: 'Bob', color: '#4ade80',
    throws: ['T20'], values: [[20, 3, 60]], _scoring: [0],
    startingScore: 66, startingRuns: 235, shanghaiIndex: 0
  }
};

saveGameToHistory({
  winner: 'Alice',
  results: [
    { position: 1, name: 'Alice', score: 0, runs: 401, turns: 9, finished: true },
    { position: 2, name: 'Bob', score: 6, runs: 295, turns: 7, finished: false },
    { position: 3, name: 'CPU', score: 201, runs: 100, turns: 3, finished: false },
    { position: 4, name: 'Player 1', score: 201, runs: 100, turns: 3, finished: false }
  ]
});

const saved = stats.games[stats.games.length - 1];
check('save: one game record appended, no per-player map persisted',
  stats.games.length === 1 && !('players' in stats));
check('save: metadata + results kept for the recent-games list',
  saved.mode === 'x01' && saved.x01Start === 301 && saved.winner === 'Alice'
  && saved.results.length === 4 && typeof saved.date === 'number');
const t0 = saved.turns[0];
check('save: lean turn (no values/_scoring/round)',
  !('values' in t0) && !('_scoring' in t0) && !('round' in t0));
check('save: turn keeps playerId/throws/total/start',
  t0.playerId === 0 && t0.throws.length === 3 && t0.total === 180 && t0.start === 301);
check('save: hits are { r, angle, ideal } only',
  t0.hits.length === 3 && Object.keys(t0.hits[0]).sort().join(',') === 'angle,ideal,r');
check('save: non-Shanghai turns carry no sh', !('sh' in t0));
check('save: in-progress turn included without total',
  saved.turns.length === 8 && saved.turns[7].playerId === 1
  && typeof saved.turns[7].total !== 'number' && saved.turns[7].throws.length === 1);
check('save: players snapshot (isCpu flag, no marks in x01)',
  saved.players.length === 4 && saved.players[2].isCpu === true
  && !('marks' in saved.players[2]) && saved.players[0].score === 0
  && saved.players[0].finished === true);

// --- derivePlayerStats: every number the stats screen shows ---
const derived = derivePlayerStats(stats.games);

check('derive: only named humans get entries (no CPU, no Player N)',
  Object.keys(derived).sort().join(',') === 'alice,bob');

const ax = derived.alice.modes.x01;
check('derive: alice x01 games/wins', ax.gamesPlayed === 1 && ax.wins === 1 && ax.winRate === 100);
check('derive: alice x01 totals',
  ax.totalRuns === 401 && ax.totalTurns === 3 && ax.totalDarts === 9 && ax.maxDarts === 9);
check('derive: alice x01 best turn/score', ax.bestTurn === 180 && ax.bestScore === 0);
check('derive: alice x01 checkout attempts/made',
  ax.checkoutAttempts === 2 && ax.checkouts === 1 && ax.checkoutPct === 50);
check('derive: alice x01 bull darts', ax.bullDarts === 0);
check('derive: alice x01 hits + misses (r > 1 kept, manual Miss counted, MISS filler not)',
  ax.hits.length === 3 && ax.totalMisses === 3);
check('derive: alice x01 averages', ax.avgPerTurn === 133.7 && ax.avgPerGame === 401);
check('derive: alice x01 180s + T20s', ax.eighteens === 1 && ax.t20s === 4);
check('derive: alice x01 gets no cricket/shanghai-only stats',
  ax.bestGame === 0 && ax.instantWins === 0 && ax.countingHits === 0 && ax.avgCountingHits === 0);
check('derive: alice cricket/shanghai untouched',
  derived.alice.modes.cricket.gamesPlayed === 0 && derived.alice.modes.shanghai.gamesPlayed === 0);

const bx = derived.bob.modes.x01;
check('derive: bob x01 games (no win)', bx.gamesPlayed === 1 && bx.wins === 0 && bx.winRate === 0);
check('derive: bob x01 best turn/score', bx.bestTurn === 160 && bx.bestScore === 6);
check('derive: bob x01 checkout (in-progress turn skipped)',
  bx.checkoutAttempts === 1 && bx.checkouts === 0 && bx.checkoutPct === 0);
check('derive: bob x01 bull darts (BE + Bull)', bx.bullDarts === 2);
check('derive: bob x01 misses (manual Miss, no recorded landings)',
  bx.hits.length === 0 && bx.totalMisses === 1);
check('derive: bob x01 totals (partial turn in darts, not in turns)',
  bx.totalTurns === 2 && bx.totalDarts === 7 && bx.maxDarts === 7 && bx.avgPerTurn === 147.5);
check('derive: bob x01 180s + T20s', bx.eighteens === 0 && bx.t20s === 2);

// Pre-full-record summary games (no turns) stay in the list but
// contribute nothing to the derivation.
stats.games.push({
  date: 2, mode: 'x01', x01Start: 301,
  players: [{ name: 'Alice', finished: true, runs: 500 }],
  winner: 'Alice', results: []
});
const derivedWithLegacy = derivePlayerStats(stats.games);
check('derive: legacy summary games are skipped',
  derivedWithLegacy.alice.modes.x01.gamesPlayed === 1
  && derivedWithLegacy.alice.modes.x01.totalRuns === 401);

// --- Second game (cricket): mode attribution + marks snapshot ---
store[STORAGE_KEY_STATS] = JSON.stringify({ games: [] });
globalThis.stats = loadStats();
globalThis.state = {
  mode: 'cricket',
  x01Start: 301,
  players: [
    { id: 0, name: 'Alice', score: 0, runs: 210, turns: 6, finished: true,
      marks: { 20: 3, 19: 3, 18: 3, 17: 3, 16: 3, 15: 3, 25: 3 } },
    { id: 1, name: 'Bob', score: 0, runs: 20, turns: 3, finished: false, marks: { 20: 1 } }
  ],
  history: [
    { round: 1, playerId: 0, name: 'Alice', color: '#60a5fa',
      throws: ['T20', 'T20', 'T20'], values: [[20, 3, 60], [20, 3, 60], [20, 3, 60]],
      _scoring: [60, 60, 60], startingScore: 0, startingRuns: 0, shanghaiIndex: 0, total: 180 },
    { // Alice t2 — D15 counts double, '5' is off-target and scores nothing
      round: 2, playerId: 0, name: 'Alice', color: '#60a5fa',
      throws: ['D15', '5', 'Miss'], values: [[15, 2, 30], [5, 1, 5], [0, 1, 0]],
      _scoring: [30, 0, 0], startingScore: 0, startingRuns: 180, shanghaiIndex: 0, total: 30 },
    { // Bob t1 — '5' is off-target
      round: 1, playerId: 1, name: 'Bob', color: '#4ade80',
      throws: ['20', '5', 'Miss'], values: [[20, 1, 20], [5, 1, 5], [0, 1, 0]],
      _scoring: [20, 0, 0], startingScore: 0, startingRuns: 0, shanghaiIndex: 0, total: 20 }
  ],
  _currentPlayerTurn: null
};
saveGameToHistory({
  winner: 'Alice',
  results: [
    { position: 1, name: 'Alice', score: 210, runs: 210, turns: 6, finished: true },
    { position: 2, name: 'Bob', score: 20, runs: 20, turns: 3, finished: false }
  ]
});

const saved2 = stats.games[0];
check('save: cricket record (x01Start null, final marks kept)',
  saved2.mode === 'cricket' && saved2.x01Start === null
  && saved2.players[0].marks[25] === 3 && saved2.players[1].marks[20] === 1);

const dcr = derivePlayerStats(stats.games);
const ac = dcr.alice.modes.cricket;
check('derive: cricket game attributed to the cricket bucket',
  ac.gamesPlayed === 1 && ac.wins === 1 && ac.winRate === 100);
check('derive: cricket totals / best turn',
  ac.totalRuns === 210 && ac.totalTurns === 2 && ac.totalDarts === 6 && ac.bestTurn === 180
  && ac.avgPerTurn === 105 && ac.avgPerGame === 210);
check('derive: cricket counting hits (T=3, D=2, S=1, off-target excluded)',
  ac.countingHits === 11 && ac.avgCountingHits === 5.5);
check('derive: cricket best leg (highest single-game score)', ac.bestGame === 210);
check('derive: cricket bucket gets no X01-only numbers',
  ac.bestScore === 0 && ac.checkoutAttempts === 0 && ac.eighteens === 0 && ac.t20s === 0);
check('derive: alice x01 empty without x01 games',
  dcr.alice.modes.x01.gamesPlayed === 0);
check('derive: bob cricket counting hits / best leg / miss',
  dcr.bob.modes.cricket.countingHits === 1 && dcr.bob.modes.cricket.avgCountingHits === 1
  && dcr.bob.modes.cricket.bestGame === 20 && dcr.bob.modes.cricket.totalRuns === 20
  && dcr.bob.modes.cricket.totalMisses === 1 && dcr.bob.modes.cricket.hits.length === 0);

// --- Third game (Shanghai): turns carry the target index, instant win ---
store[STORAGE_KEY_STATS] = JSON.stringify({ games: [] });
globalThis.stats = loadStats();
globalThis.state = {
  mode: 'shanghai',
  x01Start: 301,
  shanghaiIndex: 1,
  players: [
    { id: 0, name: 'Alice', score: 18, runs: 18, turns: 6, finished: true, marks: {} },
    { id: 1, name: 'Bob', score: 1, runs: 1, turns: 3, finished: false, marks: {} }
  ],
  history: [
    { round: 1, playerId: 0, name: 'Alice', color: '#60a5fa',
      throws: ['T1', 'T1', 'Miss'], values: [[1, 3, 3], [1, 3, 3], [0, 1, 0]],
      _scoring: [3, 3, 0], startingScore: 0, startingRuns: 0, shanghaiIndex: 0, total: 6 },
    { round: 1, playerId: 1, name: 'Bob', color: '#4ade80',
      throws: ['1', 'Miss', 'Miss'], values: [[1, 1, 1], [0, 1, 0], [0, 1, 0]],
      _scoring: [1, 0, 0], startingScore: 0, startingRuns: 0, shanghaiIndex: 0, total: 1 },
    { round: 2, playerId: 0, name: 'Alice', color: '#60a5fa',
      throws: ['T2', 'D2', '2'], values: [[2, 3, 6], [2, 2, 4], [2, 1, 2]],
      _scoring: [6, 4, 2], startingScore: 0, startingRuns: 6, shanghaiIndex: 1, total: 12 }
  ],
  _currentPlayerTurn: null
};
saveGameToHistory({
  winner: 'Alice',
  results: [
    { position: 1, name: 'Alice', score: 18, runs: 18, turns: 6, finished: true },
    { position: 2, name: 'Bob', score: 1, runs: 1, turns: 3, finished: false }
  ]
});

const saved3 = stats.games[0];
check('save: shanghai turns carry the target index',
  saved3.turns[0].sh === 0 && saved3.turns[1].sh === 0 && saved3.turns[2].sh === 1);

const dsh = derivePlayerStats(stats.games);
const ash = dsh.alice.modes.shanghai;
check('derive: shanghai game (instant win, per-target turns)',
  ash.gamesPlayed === 1 && ash.wins === 1 && ash.bestTurn === 12 && ash.totalRuns === 18
  && ash.totalTurns === 2 && ash.totalDarts === 6 && ash.totalMisses === 1);
check('derive: shanghai counting hits (per-turn target, T=3 D=2 S=1)',
  ash.countingHits === 12 && ash.avgCountingHits === 6);
check('derive: shanghai instant win + best leg',
  ash.instantWins === 1 && ash.bestGame === 18 && ash.bullDarts === 0);
check('derive: bob shanghai (no instant win)',
  dsh.bob.modes.shanghai.countingHits === 1 && dsh.bob.modes.shanghai.avgCountingHits === 1
  && dsh.bob.modes.shanghai.instantWins === 0 && dsh.bob.modes.shanghai.bestGame === 1
  && dsh.bob.modes.shanghai.totalMisses === 2);

if (failures > 0) {
  console.log(failures + ' test(s) failed');
  process.exit(1);
}
console.log('All storage tests passed');
