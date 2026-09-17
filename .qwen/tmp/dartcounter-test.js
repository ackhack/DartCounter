// E2E logic harness: loads the real main.js with a stub DOM and plays
// full X01 games to verify per-player stats persistence.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// ---------- storage ----------
const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};

// pre-seed a legacy flat stats entry to test migration
store['dartcounter_stats'] = JSON.stringify({
  players: {
    'legacy': { name: 'Legacy', gamesPlayed: 3, wins: 1, totalRuns: 900, totalTurns: 45, bestTurn: 180, bestScore: 0 }
  },
  games: []
});

// ---------- element stub ----------
let createdCount = 0;
function makeEl(id) {
  const el = {
    id,
    dataset: {},
    style: {},
    children: [],
    listeners: {},
    disabled: false,
    value: '',
    scrollTop: 0,
    _innerHTML: '',
    _textContent: '',
    classList: {
      _set: new Set(),
      add(...c) { c.forEach(x => this._set.add(x)); },
      remove(...c) { c.forEach(x => this._set.delete(x)); },
      toggle(c, force) {
        if (force === undefined) { this._set.has(c) ? this._set.delete(c) : this._set.add(c); }
        else if (force) this._set.add(c);
        else this._set.delete(c);
      },
      contains(c) { return this._set.has(c); }
    },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    click() { (this.listeners['click'] || []).forEach(fn => fn()); },
    appendChild(child) { this.children.push(child); return child; },
    prepend(child) { this.children.unshift(child); return child; },
    querySelector() { return makeEl('sub-' + (++createdCount)); },
    querySelectorAll() { return []; },
    set innerHTML(v) { this._innerHTML = String(v); if (v === '') this.children = []; },
    get innerHTML() { return this._innerHTML; },
    set textContent(v) { this._textContent = v; },
    get textContent() { return this._textContent; }
  };
  return el;
}

const els = {};
function getEl(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; }
getEl('end-modal').classList.add('hidden');

// ---------- button registries ----------
const modeBtns = ['x01', 'cricket'].map(m => { const b = makeEl('mode-' + m); b.dataset.mode = m; return b; });
const scoreBtns = ['301', '501', '701'].map(s => { const b = makeEl('score-' + s); b.dataset.score = s; return b; });
const countBtns = ['2', '3', '4', '5', '6', '7', '8'].map(c => { const b = makeEl('count-' + c); b.dataset.count = c; return b; });
const numBtns = Array.from({ length: 20 }, (_, i) => { const b = makeEl('num-' + (i + 1)); b.dataset.num = String(i + 1); return b; });
const multBtns = ['1', '2', '3'].map(m => { const b = makeEl('mult-' + m); b.dataset.mult = m; return b; });
const specialBtns = [['bull', 'bull'], ['bulleye', 'be'], ['0', 'miss']].map(([d, id]) => { const b = makeEl('special-' + id); b.dataset.special = d; return b; });
const nameInputs = [0, 1, 2].map(i => makeEl('name-input-' + i));

// ---------- document/window/navigator ----------
const document = {
  querySelector(sel) {
    if (sel.startsWith('#')) return getEl(sel.slice(1));
    return null;
  },
  querySelectorAll(sel) {
    switch (sel) {
      case '.mode-btn': return modeBtns;
      case '.score-btn': return scoreBtns;
      case '.count-btn': return countBtns;
      case '.num-btn': return numBtns;
      case '.mult-btn': return multBtns;
      case '.special-btn': return specialBtns;
      case '.name-input':
        // only inputs for the currently rendered wrappers count
        return nameInputs.slice(0, getEl('name-inputs').children.length);
      default: return [];
    }
  },
  createElement() { return makeEl('created-' + (++createdCount)); }
};
const window = { addEventListener() {} };
const navigator = {};

// ---------- load the app ----------
const src = fs.readFileSync(path.join(__dirname, '../../main.js'), 'utf8');
function loadApp() {
  new Function('document', 'window', 'navigator', 'localStorage', src)(document, window, navigator, localStorage);
}
loadApp();

// ---------- game drivers ----------
const modalHidden = () => getEl('end-modal').classList.contains('hidden');

function startGame(names) {
  getEl('name-inputs').children.length = 0; // reset rendered wrappers
  countBtns[String(names.length) - 2].click(); // index 0 => 2 players
  names.forEach((n, i) => { nameInputs[i].value = n; });
  getEl('start-game-btn').click();
}

function throwSingle(n) { numBtns[n - 1].click(); }
function throwDouble(n) { multBtns[1].click(); numBtns[n - 1].click(); }
function throwTriple(n) { multBtns[2].click(); numBtns[n - 1].click(); }

// exact checkout sequence for a remaining score <= 60 (never busts)
function checkoutSequence(s) {
  if (s <= 20) return [[1, s]];
  if (s % 2 === 0 && s / 2 <= 20) return [[2, s / 2]];
  if (s % 3 === 0 && s / 3 <= 20) return [[3, s / 3]];
  const a = 20, b = Math.min(20, s - 20), c = s - a - b;
  return [a, b, c].filter(v => v > 0).map(v => [1, v]);
}

function throwDart(kind, n) {
  if (kind === 1) throwSingle(n);
  else if (kind === 2) throwDouble(n);
  else throwTriple(n);
}

// Strategy for 301: T20 until the turn starting at 121, where T20 + 1 + MISS
// parks the player at exactly 60; the next turn is then a true checkout.
function playToCompletion(maxDarts = 400) {
  let darts = 0;
  let lastName = '';
  let turnStart = 0;
  while (modalHidden() && darts < maxDarts) {
    const s = Number(getEl('active-player-score').textContent);
    const name = getEl('active-player-name').textContent;
    if (name !== lastName) { lastName = name; turnStart = s; }

    if (s <= 60) {
      for (const [kind, n] of checkoutSequence(s)) {
        throwDart(kind, n);
        darts++;
        if (!modalHidden()) break;
      }
      continue;
    }
    if (turnStart === 121 && s === 61) {
      throwSingle(1); darts++;
      specialBtns[2].click(); darts++; // MISS — end turn at exactly 60
      continue;
    }
    throwTriple(20);
    darts++;
  }
  assert.ok(!modalHidden(), 'game did not finish in time');
  return darts;
}

// ---------- helpers ----------
function readStats() { return JSON.parse(store['dartcounter_stats']); }

// ---------- TEST 2: play a full X01 game ----------
startGame(['Alice', 'Bob']);
playToCompletion();

let stats = readStats();
const alice = stats.players['alice'];
const bob = stats.players['bob'];
assert.ok(alice && bob, 'players saved by lowercased name');
for (const [pname, p] of [['alice', alice], ['bob', bob]]) {
  const m = p.modes.x01;
  const expectedFields = ['gamesPlayed', 'wins', 'totalRuns', 'totalTurns', 'totalDarts', 'maxDarts',
    'bestTurn', 'bestScore', 'checkoutAttempts', 'checkouts', 'bullDarts',
    'avgPerTurn', 'avgPerGame', 'winRate', 'checkoutPct'];
  for (const f of expectedFields) assert.ok(typeof m[f] === 'number', `${pname}.${f} missing`);
  // averages consistent with totals
  const expAvgTurn = m.totalTurns > 0 ? Math.round(m.totalRuns / m.totalTurns * 10) / 10 : 0;
  const expAvgGame = m.gamesPlayed > 0 ? Math.round(m.totalRuns / m.gamesPlayed * 10) / 10 : 0;
  const expWinRate = m.gamesPlayed > 0 ? Math.round(m.wins / m.gamesPlayed * 100) : 0;
  const expCo = m.checkoutAttempts > 0 ? Math.round(m.checkouts / m.checkoutAttempts * 100) : 0;
  assert.strictEqual(m.avgPerTurn, expAvgTurn, `${pname} avgPerTurn`);
  assert.strictEqual(m.avgPerGame, expAvgGame, `${pname} avgPerGame`);
  assert.strictEqual(m.winRate, expWinRate, `${pname} winRate`);
  assert.strictEqual(m.checkoutPct, expCo, `${pname} checkoutPct`);
}
const winner = alice.modes.x01.wins === 1 ? alice : bob;
const loser = winner === alice ? bob : alice;
assert.strictEqual(winner.modes.x01.gamesPlayed, 1);
assert.strictEqual(loser.modes.x01.gamesPlayed, 1);
assert.strictEqual(winner.modes.x01.wins, 1);
assert.strictEqual(loser.modes.x01.wins, 0);
assert.strictEqual(winner.modes.x01.checkouts, 1, 'winner finished from a <=60 position');
assert.strictEqual(winner.modes.x01.checkoutAttempts, 1);
assert.strictEqual(winner.modes.x01.checkoutPct, 100);
assert.strictEqual(loser.modes.x01.checkouts, 0, 'loser never finished');
assert.strictEqual(winner.modes.x01.bestScore, 0, 'winner finished, bestScore 0');
assert.ok(loser.modes.x01.bestScore > 0, 'loser did not finish');
assert.ok(winner.modes.x01.totalDarts >= winner.modes.x01.totalTurns * 3 - 3, 'darts >= turns*3 (last turn shorter)');
console.log(`PASS 2: X01 game stats (winner=${winner.name}, ${winner.modes.x01.totalDarts} darts / ${winner.modes.x01.totalTurns} turns, checkout ${winner.modes.x01.checkoutPct}%)`);

// ---------- TEST 2b: legacy migration (persisted after first saveStats) ----------
const legacy = stats.players['legacy'];
assert.ok(legacy.modes, 'legacy entry should have modes after migration');
assert.strictEqual(legacy.modes.x01.gamesPlayed, 3);
assert.strictEqual(legacy.modes.x01.totalDarts, 45, 'legacy totalTurns (per-dart) maps to totalDarts');
assert.strictEqual(legacy.modes.x01.totalTurns, 0);
assert.strictEqual(legacy.modes.x01.bestTurn, 180);
assert.strictEqual(legacy.modes.x01.bestScore, 0);
assert.strictEqual(legacy.modes.cricket.gamesPlayed, 0);
assert.ok(!('gamesPlayed' in legacy), 'flat fields should be removed');
console.log('PASS 2b: legacy migration');

// ---------- TEST 3: stats screen renders ----------
getEl('view-stats-btn').click();
const listEl = getEl('stats-list');
const listHtml = listEl.children.map(c => c.innerHTML).join('');
assert.ok(listHtml.includes('Alice'), 'stats screen shows Alice');
assert.ok(listHtml.includes('Bob'), 'stats screen shows Bob');
assert.ok(listHtml.includes('Legacy'), 'stats screen shows migrated Legacy player');
assert.ok(listHtml.includes('Checkout %'), 'x01 card shows checkout %');
assert.ok(!listHtml.includes('No stats yet'), 'no empty state');
console.log('PASS 3: stats screen renders');

// ---------- TEST 3b: screen switching deactivates all other screens ----------
const activeScreens = () =>
  Object.entries({ setup: getEl('setup-screen'), game: getEl('game-screen'), stats: getEl('stats-screen') })
    .filter(([, el]) => el.classList.contains('active'))
    .map(([n]) => n);
assert.deepStrictEqual(activeScreens(), ['stats'], 'only stats active after opening stats');
getEl('stats-back-btn').click();
assert.deepStrictEqual(activeScreens(), ['setup'], 'only setup active after back');
console.log('PASS 3b: screen switching');

// ---------- TEST 4: replay accumulates ----------
getEl('replay-btn').click(); // back into game with same names, loser first
playToCompletion();
stats = readStats();
const a2 = stats.players['alice'].modes.x01;
const b2 = stats.players['bob'].modes.x01;
assert.strictEqual(a2.gamesPlayed + b2.gamesPlayed, 4, 'both players at 2 games');
assert.strictEqual(a2.wins + b2.wins, 2, 'two total wins across two games');
assert.ok(a2.checkouts + b2.checkouts >= 2, 'each game produced a checkout');
console.log(`PASS 4: replay accumulates (alice: ${a2.wins}W/${a2.gamesPlayed}G, bob: ${b2.wins}W/${b2.gamesPlayed}G)`);

// ---------- TEST 5: stats persist across reload ----------
loadApp();
const after = JSON.parse(store['dartcounter_stats']);
assert.strictEqual(after.players['alice'].modes.x01.gamesPlayed, a2.gamesPlayed, 'stats survived reload');
assert.ok(after.players['legacy'].modes, 'migration idempotent on reload');
console.log('PASS 5: persistence across reload');

// ---------- TEST 6: user scenario — stats screen then Start Game ----------
getEl('view-stats-btn').click();
assert.deepStrictEqual(activeScreens(), ['stats']);
startGame(['Alice', 'Bob']);
assert.deepStrictEqual(activeScreens(), ['game'], 'starting a game must not leave stats screen active');
console.log('PASS 6: start game after stats shows only the game screen');

console.log('\nALL TESTS PASSED');
