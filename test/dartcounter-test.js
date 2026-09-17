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

// pre-seed a legacy flat stats entry to test migration, plus a
// current-format entry whose x01 bestTurn was inflated by the old
// total-runs bug (301 > max possible single turn of 180) to test the repair
const zeroMode = () => ({ gamesPlayed: 0, wins: 0, totalRuns: 0, totalTurns: 0, totalDarts: 0, maxDarts: 0, bestTurn: 0, bestScore: 0, checkoutAttempts: 0, checkouts: 0, bullDarts: 0, avgPerTurn: 0, avgPerGame: 0, winRate: 0, checkoutPct: 0 });
store['dartcounter_stats'] = JSON.stringify({
  players: {
    'legacy': { name: 'Legacy', gamesPlayed: 3, wins: 1, totalRuns: 900, totalTurns: 45, bestTurn: 180, bestScore: 0 },
    'old': { name: 'Old', modes: { x01: { ...zeroMode(), gamesPlayed: 1, wins: 0, totalRuns: 301, totalTurns: 5, totalDarts: 14, bestTurn: 301, bestScore: 21 }, cricket: zeroMode() } }
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
    removeChild(child) { const i = this.children.indexOf(child); if (i >= 0) this.children.splice(i, 1); return child; },
    prepend(child) { this.children.unshift(child); return child; },
    focus() {},
    setAttribute() {},
    getAttribute() { return null; },
    // Cache per selector so repeated querySelector calls return the same
    // sub-element (as a real DOM would) — lets the harness click the
    // per-row remove buttons the app attached listeners to.
    querySelector(sel) {
      this._subEls = this._subEls || {};
      if (!this._subEls[sel]) this._subEls[sel] = makeEl(this.id + ':' + sel);
      return this._subEls[sel];
    },
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
const nameInputs = Array.from({ length: 10 }, (_, i) => makeEl('name-input-' + i));
const nameInputPool = [...nameInputs];

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
      case '.name-input-wrapper': return getEl('name-inputs').children;
      case '.remove-player-btn':
        return getEl('name-inputs').children.map(w => w.querySelector('.remove-player-btn'));
      default: return [];
    }
  },
  createElement() { return makeEl('created-' + (++createdCount)); }
};
const window = { addEventListener() {} };
const navigator = {};

// ---------- confirm/alert stubs ----------
// Bare confirm()/alert() calls in the app's IIFE resolve via Node's global
// scope; default to "user confirms" and flip per-test for cancel paths.
global.confirm = () => true;
global.alert = () => {};

// ---------- load the app ----------
const src = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
function loadApp() {
  // A real page navigation replaces ALL listeners — clear them so a reload
  // doesn't accumulate duplicate handlers on the stub elements.
  const reset = el => { el.listeners = {}; };
  Object.values(els).forEach(reset);
  [...modeBtns, ...scoreBtns, ...countBtns, ...numBtns, ...multBtns, ...specialBtns, ...nameInputPool].forEach(reset);
  new Function('document', 'window', 'navigator', 'localStorage', src)(document, window, navigator, localStorage);
}
loadApp();

// ---------- game drivers ----------
const modalHidden = () => getEl('end-modal').classList.contains('hidden');

function startGame(names) {
  getEl('name-inputs').children.length = 0; // reset rendered wrappers
  nameInputs.length = 0;
  nameInputs.push(...nameInputPool); // undo any splices from removeRow()
  if (names.length <= 8) {
    countBtns[names.length - 2].click(); // index 0 => 2 players
  } else {
    countBtns[6].click(); // 8 via shortcut, the rest via the plus button
    for (let i = 8; i < names.length; i++) getEl('add-player-btn').click();
  }
  names.forEach((n, i) => { nameInputs[i].value = n; });
  getEl('start-game-btn').click();
}

// Click a row's ✕ button and splice the stub input pool so the harness'
// .name-input slice stays faithful to the live rows.
function removeRow(idx) {
  const wrappers = getEl('name-inputs').children;
  wrappers[idx].querySelector('.remove-player-btn').click();
  nameInputs.splice(idx, 1);
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
assert.strictEqual(winner.modes.x01.checkouts, 1, 'winner finished on a checkout turn');
assert.strictEqual(winner.modes.x01.checkoutAttempts, 2, 'turns started from 121 and 60 were both opportunities');
assert.strictEqual(winner.modes.x01.checkoutPct, 50);
assert.strictEqual(loser.modes.x01.checkouts, 0, 'loser never finished');
assert.strictEqual(loser.modes.x01.checkoutAttempts, 1, 'loser had one opportunity (turn from 121)');
assert.strictEqual(winner.modes.x01.bestScore, 0, 'winner finished, bestScore 0');
assert.ok(loser.modes.x01.bestScore > 0, 'loser did not finish');
// Best Turn must be a single-turn score: strategy turns are 180 (3xT20),
// 61 (T20+1+MISS from 121), 60 (T20 checkout) — never the game-total runs
assert.strictEqual(winner.modes.x01.bestTurn, 180, 'winner best turn is the 180 turn, not total runs (301)');
assert.strictEqual(loser.modes.x01.bestTurn, 180, 'loser also threw an 180 turn before game over');
assert.ok(winner.modes.x01.totalDarts >= winner.modes.x01.totalTurns * 3 - 3, 'darts >= turns*3 (last turn shorter)');
assert.strictEqual(stats.players['old'].modes.x01.bestTurn, 0, 'corrupt pre-fix bestTurn (>180) is reset on load');
console.log(`PASS 2: X01 game stats (winner=${winner.name}, ${winner.modes.x01.totalDarts} darts / ${winner.modes.x01.totalTurns} turns, checkout ${winner.modes.x01.checkoutPct}%)`);

// ---------- TEST 2b: legacy migration (persisted after first saveStats) ----------
const legacy = stats.players['legacy'];
assert.ok(legacy.modes, 'legacy entry should have modes after migration');
assert.strictEqual(legacy.modes.x01.gamesPlayed, 3);
assert.strictEqual(legacy.modes.x01.totalDarts, 45, 'legacy totalTurns (per-dart) maps to totalDarts');
assert.strictEqual(legacy.modes.x01.totalTurns, 0);
assert.strictEqual(legacy.modes.x01.bestTurn, 0, 'legacy bestTurn was corrupt (max total runs) and unrecoverable — dropped');
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
assert.strictEqual(a2.bestTurn, 180, 'bestTurn is the max single turn across games, not cumulative');
assert.strictEqual(b2.bestTurn, 180, 'bestTurn is the max single turn across games, not cumulative');
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

// ---------- TEST 7: X01 bust auto-fills misses and advances to next player ----------
// Fresh names so stats are not cumulative with earlier tests
startGame(['Carl', 'Dan']);
// Turns alternate: Carl T1, Dan T1, Carl T2, Dan T2
throwTriple(20); throwTriple(20); throwTriple(20); // Carl T1: 301→121
throwTriple(20); throwTriple(20); throwTriple(20); // Dan T1: 301→121
throwTriple(20); throwSingle(2); specialBtns[2].click(); // Carl T2: 121→61→59→59
throwTriple(20); throwSingle(2); specialBtns[2].click(); // Dan T2: 121→61→59→59
// Carl T3: T20 from 59 -> BUST -> turn must auto-complete with 2 misses, Dan active
throwTriple(20);
assert.strictEqual(getEl('active-player-name').textContent, 'Dan', 'bust should end the turn and pass to the next player');
assert.strictEqual(Number(getEl('active-player-score').textContent), 59, 'bust reverts Carl; Dan is at 59');
// Dan T3: 59 -> 20, 20, 19 -> finished -> game over
throwSingle(20); throwSingle(20); throwSingle(19);
assert.ok(!modalHidden(), 'game over after Dan checks out');

stats = readStats();
const carl = stats.players['carl'].modes.x01;
const dan = stats.players['dan'].modes.x01;
assert.strictEqual(carl.totalTurns, 3, 'Carl had 3 turns incl. the busted one');
assert.strictEqual(carl.totalRuns, 242, 'bust value and auto-misses score nothing');
assert.strictEqual(carl.checkoutAttempts, 2, 'turns from 121 and 59 were opportunities; the 59 turn busted');
assert.strictEqual(carl.checkouts, 0);
// Busted turn totals 0 in history; both players' best turn is the opening 3xT20 turn
assert.strictEqual(carl.bestTurn, 180, 'bust turn scores 0, best turn is the 180 turn');
assert.strictEqual(dan.bestTurn, 180);
assert.strictEqual(dan.wins, 1);
assert.strictEqual(dan.checkouts, 1);
assert.strictEqual(dan.checkoutAttempts, 2, 'Dan had opportunities from 121 and the finishing 59');
console.log('PASS 7: bust ends turn, auto-misses, next player');

// ---------- TEST 8: undoing a busted turn, then re-throwing, keeps dart counts balanced ----------
startGame(['Eve', 'Frank']);
throwTriple(20); throwTriple(20); throwTriple(20); // Eve T1: 301→121
throwTriple(20); throwTriple(20); throwTriple(20); // Frank T1: 301→121
throwTriple(20); throwSingle(2); specialBtns[2].click(); // Eve T2: →59
throwTriple(20); throwSingle(2); specialBtns[2].click(); // Frank T2: →59
throwTriple(20); // Eve T3: T20 from 59 → BUST + 2 auto-misses
assert.strictEqual(getEl('active-player-name').textContent, 'Frank', 'bust ends the turn and passes to the next player');
// Undo all 3 darts of the busted turn: 2 auto-misses + the bust itself
getEl('undo-btn').click();
getEl('undo-btn').click();
getEl('undo-btn').click();
assert.strictEqual(getEl('active-player-name').textContent, 'Eve', 'full undo restores Eve mid-flow');
assert.strictEqual(Number(getEl('active-player-score').textContent), 59, 'score unchanged after full undo');
// Eve re-throws T3: 20, 20, 19 → finished → game over
throwSingle(20); throwSingle(20); throwSingle(19);
assert.ok(!modalHidden(), 'game over after Eve checks out on the re-thrown turn');

stats = readStats();
const eve = stats.players['eve'].modes.x01;
const frank = stats.players['frank'].modes.x01;
assert.strictEqual(eve.totalTurns, 3, 'Eve: 3 completed turns');
assert.strictEqual(eve.totalDarts, 9, 'Eve: 3+3+3 darts — undo/re-throw must not leak or drop darts');
assert.strictEqual(eve.totalRuns, 301);
assert.strictEqual(eve.checkouts, 1);
assert.strictEqual(eve.wins, 1);
assert.strictEqual(frank.totalDarts, 6, 'Frank: 2 turns × 3 darts');
assert.strictEqual(frank.totalRuns, 242);
console.log('PASS 8: bust undo + re-throw keeps dart counts balanced');

// ---------- TEST 9: add/remove players in setup — no upper limit, min 2 ----------
getEl('back-to-setup-btn').click();
const rowCount = () => getEl('name-inputs').children.length;
const rowValues = () => nameInputs.slice(0, rowCount()).map(i => i.value);
const rowNumbers = () => getEl('name-inputs').children.map(w => String(w.querySelector('.player-number').textContent));

assert.strictEqual(rowCount(), 2, 'setup shows the 2 rows from the previous setup');
for (let i = 0; i < 3; i++) getEl('add-player-btn').click();
assert.strictEqual(rowCount(), 5, 'plus button adds rows');
nameInputs.slice(0, 5).forEach((inp, i) => { inp.value = ['Amy', 'Ben', 'Cal', 'Dot', 'Eli'][i]; });
removeRow(1); // remove Ben
assert.strictEqual(rowCount(), 4, 'x button removes the row');
assert.deepStrictEqual(rowValues(), ['Amy', 'Cal', 'Dot', 'Eli'], 'other names preserved after removal');
assert.deepStrictEqual(rowNumbers(), ['1', '2', '3', '4'], 'rows renumbered after removal');
// grow past the old limit of 8
for (let i = 0; i < 5; i++) getEl('add-player-btn').click();
assert.strictEqual(rowCount(), 9, 'no upper limit — 9 rows allowed');
assert.ok(countBtns.every(b => !b.classList.contains('active')), 'no count shortcut active beyond 8');
// count shortcut re-renders; then shrink to the minimum of 2
countBtns[2].click(); // 4 rows
assert.strictEqual(rowCount(), 4);
removeRow(3);
removeRow(2);
assert.strictEqual(rowCount(), 2, 'can remove down to 2 players');
assert.ok(document.querySelectorAll('.remove-player-btn').every(b => b.disabled), 'x buttons disabled at the minimum');
removeRow(0);
assert.strictEqual(rowCount(), 2, 'cannot remove below 2 players');
console.log('PASS 9: add/remove players (unlimited, min 2, names preserved, renumbered)');

// ---------- TEST 10: full game with 9 players (beyond the old 8-player cap) ----------
startGame(['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9']);
playToCompletion();
stats = readStats();
let newWins = 0;
for (let i = 1; i <= 9; i++) {
  const p = stats.players['n' + i];
  assert.ok(p, `player n${i} has stats`);
  assert.strictEqual(p.modes.x01.gamesPlayed, 1, `n${i} played 1 game`);
  newWins += p.modes.x01.wins;
}
assert.strictEqual(newWins, 1, 'exactly one of the 9 players won');
console.log('PASS 10: full X01 game with 9 players');

// ---------- TEST 11: End button requires confirmation ----------
getEl('back-to-setup-btn').click(); // close the end modal from TEST 10
startGame(['Gus', 'Hal']);
throwTriple(20); // one dart in, game mid-flight
global.confirm = () => false;
getEl('end-game-btn').click();
assert.ok(modalHidden(), 'confirm=false must not end the game');
global.confirm = () => true;
getEl('end-game-btn').click();
assert.ok(!modalHidden(), 'confirm=true finalizes the game');
stats = readStats();
assert.strictEqual(stats.players['gus'].modes.x01.gamesPlayed, 1, 'manual end records stats');
assert.strictEqual(stats.players['hal'].modes.x01.gamesPlayed, 1, 'manual end records stats');
console.log('PASS 11: End button requires confirmation');

// ---------- TEST 12: duplicate player names are rejected ----------
getEl('back-to-setup-btn').click();
const alerts = [];
global.alert = msg => { alerts.push(msg); };
startGame(['Ivy', 'ivy']);
assert.strictEqual(alerts.length, 1, 'case-insensitive duplicate triggers an alert');
assert.ok(!getEl('game-screen').classList.contains('active'), 'game does not start on duplicate names');
assert.deepStrictEqual(activeScreens(), ['setup']);
global.alert = () => {};
console.log('PASS 12: duplicate names rejected');

// ---------- TEST 13: per-player stats reset ----------
getEl('view-stats-btn').click();
const gusCard = getEl('stats-list').children.find(c => c.innerHTML.includes('Gus'));
assert.ok(gusCard, 'stats screen renders Gus');
const resetBtn = gusCard.querySelector('.stats-reset-btn');

global.confirm = () => false;
resetBtn.click();
assert.ok(JSON.parse(store['dartcounter_stats']).players['gus'], 'confirm=false keeps stats');

global.confirm = () => true;
resetBtn.click();
assert.ok(!JSON.parse(store['dartcounter_stats']).players['gus'], 'confirm=true removes stats');
assert.ok(!getEl('stats-list').children.some(c => c.innerHTML.includes('Gus')), 'list re-renders without Gus');
console.log('PASS 13: per-player stats reset');

// ---------- TEST 14: recent games list renders on the stats screen ----------
const rgEl = getEl('recent-games');
assert.ok(!rgEl.classList.contains('hidden'), 'recent games visible after finished games');
const rgHtml = rgEl.innerHTML;
assert.ok(rgHtml.includes('X01 301'), 'shows mode + start score');
assert.ok(rgHtml.includes('Gus wins'), 'shows the winner of the manually ended game');
assert.ok(rgHtml.includes('Hal'), 'shows the other player\'s final score');
console.log('PASS 14: recent games list renders');

// ---------- TEST 15: cricket — queue marks turn blue once every player has closed a number ----------
getEl('stats-back-btn').click();
modeBtns[1].click(); // cricket
startGame(['Pam', 'Quin']);
const queueHtml = () => getEl('queue-list').children.map(c => c.innerHTML).join('');
throwTriple(20); throwTriple(20); throwTriple(20); // Pam T1: closes 20 (3 marks)
assert.ok(queueHtml().includes('class="queue-mark closed"'), 'queue mark is green when only this player has closed the number');
assert.ok(!queueHtml().includes('closed-all'), 'no blue queue mark while another player is still open');
throwTriple(20); throwTriple(20); throwTriple(20); // Quin T1: closes 20 — all players now have 3 marks on 20
assert.ok(modalHidden(), 'game continues after every player closes one number');
assert.ok(queueHtml().includes('class="queue-mark closed-all"'), 'queue mark turns blue once every player has closed the number');
console.log('PASS 15: cricket queue mark blue when all players closed the number');

// ---------- TEST 16: x01 multiplier preview shows the value each number would score ----------
modeBtns[0].click(); // back to x01 (TEST 15 left cricket selected)
startGame(['Ike', 'Jay']);
multBtns[1].click(); // Double, pending before a number press
assert.strictEqual(numBtns[19].dataset.multPreview, '40', 'Double: 20 previews 40');
assert.strictEqual(numBtns[0].dataset.multPreview, '2', 'Double: 1 previews 2');
assert.strictEqual(numBtns[18].dataset.multPreview, '38', 'Double: 19 previews 38');
multBtns[2].click(); // Triple
assert.strictEqual(numBtns[19].dataset.multPreview, '60', 'Triple: 20 previews 60');
multBtns[0].click(); // Single
assert.strictEqual(numBtns[19].dataset.multPreview, undefined, 'Single: no preview');
// Scoring clears the preview (clearInput path)
multBtns[2].click();
numBtns[19].click(); // T20 with the pending triple, input resets after scoring
assert.strictEqual(numBtns[19].dataset.multPreview, undefined, 'preview clears after a scored throw');
console.log('PASS 16: x01 multiplier preview on number buttons');

// ---------- TEST 17: cricket shows no multiplier preview ----------
modeBtns[1].click();
startGame(['Kim', 'Leo']);
multBtns[1].click(); // Double
assert.ok(numBtns.every(b => b.dataset.multPreview === undefined), 'cricket: no previews on any number button');
console.log('PASS 17: cricket shows no multiplier preview');

console.log('\nALL TESTS PASSED');
