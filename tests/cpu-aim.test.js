// ===========================
// DART COUNTER - CPU Aim (cricket / Shanghai) Tests
// ===========================
// Run: node tests/cpu-aim.test.js
//
// Plain Node, no test runner — mirrors the project's build-free setup.
// Loads js/constants.js, js/polar.js, js/render.js and js/cpu.js (all
// top-level function-only, no DOM at load) and drives the mode-aware aim
// functions with a stubbed `state`: the pure Shanghai win-combo multiplier
// logic (shanghaiWinAimMult), cpuShanghaiIdeal against fake in-progress
// turns (darts off the current target don't count toward the combo, the
// bull round is never winnable), and cpuCricketIdeal against fake cricket
// boards (suggested number, null fallback, bull -> BE). Exits non-zero on
// any failure.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

['constants.js', 'polar.js', 'render.js', 'cpu.js'].forEach((f) => {
  vm.runInThisContext(
    fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'),
    { filename: f }
  );
});

// The real app's state (js/state.js) has DOM dependencies — stub just the
// fields the aim functions read.
globalThis.state = {
  mode: 'shanghai',
  shanghaiIndex: 0,
  players: [],
  _currentPlayerTurn: null
};

let failures = 0;
function check(name, cond, extra) {
  if (cond) {
    console.log('ok:   ' + name);
  } else {
    failures++;
    console.log('FAIL: ' + name + (extra !== undefined ? '  [' + extra + ']' : ''));
  }
}

// --- shanghaiWinAimMult (pure: the multiplier to aim for while S+D+T is
// still reachable this turn) ---
check('no hits yet -> no win aim (default to triple)', shanghaiWinAimMult(new Set()) === null);
check('single hit -> aim triple (highest not hit)', shanghaiWinAimMult(new Set([1])) === 3);
check('double hit -> aim triple (highest not hit)', shanghaiWinAimMult(new Set([2])) === 3);
check('triple hit -> aim double (highest not hit)', shanghaiWinAimMult(new Set([3])) === 2);
check('single+double -> aim triple (1&2=3)', shanghaiWinAimMult(new Set([1, 2])) === 3);
check('double+triple -> aim single (2&3=1)', shanghaiWinAimMult(new Set([2, 3])) === 1);
check('single+triple -> aim double (1&3=2)', shanghaiWinAimMult(new Set([1, 3])) === 2);

// --- cpuShanghaiIdeal ---
// target = SHANGHAI_TARGETS[state.shanghaiIndex]; values = [value, mult, total]
function shanghaiState(index, values) {
  state.mode = 'shanghai';
  state.shanghaiIndex = index;
  state._currentPlayerTurn = values ? { values: values } : null;
}

shanghaiState(0); // target 1, fresh turn
check('shanghai: fresh turn aims triple of the target (T1)', cpuShanghaiIdeal() === 'T1');

shanghaiState(0, [[1, 1, 1]]);
check('shanghai: after S1 aim triple (highest not hit)', cpuShanghaiIdeal() === 'T1');
shanghaiState(0, [[1, 2, 2]]);
check('shanghai: after D1 aim triple (highest not hit)', cpuShanghaiIdeal() === 'T1');
shanghaiState(0, [[1, 3, 3]]);
check('shanghai: after T1 aim double (highest not hit)', cpuShanghaiIdeal() === 'D1');

shanghaiState(0, [[1, 1, 1], [1, 2, 2]]);
check('shanghai: S1+D1 -> aim triple to win (1&2=3)', cpuShanghaiIdeal() === 'T1');
shanghaiState(0, [[1, 1, 1], [1, 3, 3]]);
check('shanghai: S1+T1 -> aim double to win (1&3=2)', cpuShanghaiIdeal() === 'D1');
shanghaiState(0, [[1, 2, 2], [1, 3, 3]]);
check('shanghai: D1+T1 -> aim single to win (2&3=1)', cpuShanghaiIdeal() === '1');

shanghaiState(5, [[18, 3, 54], [6, 1, 6]]); // target 6: T18, then S6
check('shanghai: darts on other numbers do not count toward the combo', cpuShanghaiIdeal() === 'T6');
shanghaiState(5, [[6, 2, 12], [6, 3, 18]]);
check('shanghai: D6+T6 -> aim single to win', cpuShanghaiIdeal() === '6');

shanghaiState(19, [[20, 3, 60]]);
check('shanghai: after T20 aim double to win', cpuShanghaiIdeal() === 'D20');

// Bull round (index 20, target 25) — no triple ring, never winnable.
shanghaiState(20);
check('shanghai: bull round aims the bulls-eye (max points)', cpuShanghaiIdeal() === 'BE');
shanghaiState(20, [[25, 2, 50], [25, 1, 25]]); // BE + bull already hit
check('shanghai: bull round never plays the win combo', cpuShanghaiIdeal() === 'BE');

// --- cpuCricketIdeal ---
// marks arrays are aligned with CRICKET_NUMBERS = [15, 16, 17, 18, 19, 20, 25]
const CRICKET_NUMS = [15, 16, 17, 18, 19, 20, 25];
function marksFrom(arr) {
  const marks = {};
  CRICKET_NUMS.forEach((n, i) => { marks[n] = arr[i] || 0; });
  return marks;
}
// players: [{ runs, marks }] — the first is the CPU being aimed for
function cricketState(players) {
  state.mode = 'cricket';
  state._currentPlayerTurn = null;
  state.players = players.map((p, i) => ({
    id: i, name: 'P' + i, runs: p.runs, finished: false, marks: marksFrom(p.marks)
  }));
  return state.players[0];
}

let cpu = cricketState([
  { runs: 0, marks: [0, 0, 0, 0, 0, 3, 3] }, // CPU closed 20 + bull
  { runs: 10, marks: [0, 0, 0, 0, 0, 3, 3] } // opp closed 20 + bull
]);
check('cricket: behind -> T of highest number not closed by every player (T19)',
  cpuCricketIdeal(cpu) === 'T19', cpuCricketIdeal(cpu));

cpu = cricketState([
  { runs: 0, marks: [0, 0, 0, 0, 0, 0, 0] },
  { runs: 10, marks: [3, 3, 3, 3, 3, 3, 0] } // opp closed 15-20
]);
check('cricket: behind, only the bull open -> aim the bulls-eye',
  cpuCricketIdeal(cpu) === 'BE', cpuCricketIdeal(cpu));

cpu = cricketState([
  { runs: 10, marks: [0, 0, 0, 0, 2, 3, 3] }, // leading, 19 has 2 marks
  { runs: 0, marks: [0, 0, 0, 0, 0, 0, 0] }
]);
check('cricket: leading -> T of highest number the player has not closed (T19)',
  cpuCricketIdeal(cpu) === 'T19', cpuCricketIdeal(cpu));

cpu = cricketState([
  { runs: 10, marks: [3, 3, 3, 3, 3, 3, 3] }, // leading, fully closed
  { runs: 0, marks: [0, 0, 0, 0, 0, 3, 3] } // opp closed 20 + bull
]);
check('cricket: fully closed while leading -> bank on highest still-scoring number (T19)',
  cpuCricketIdeal(cpu) === 'T19', cpuCricketIdeal(cpu));

cpu = cricketState([
  { runs: 10, marks: [3, 3, 3, 3, 3, 3, 3] }, // fully closed
  { runs: 0, marks: [3, 3, 3, 3, 3, 3, 0] } // opp: only the bull open
]);
check('cricket: bull is the only number still scoring -> aim the bulls-eye (50 pts)',
  cpuCricketIdeal(cpu) === 'BE', cpuCricketIdeal(cpu));

cpu = cricketState([
  { runs: 10, marks: [3, 3, 3, 3, 3, 3, 3] },
  { runs: 0, marks: [3, 3, 3, 3, 3, 3, 3] } // board fully closed
]);
check('cricket: board fully closed -> harmless T20 fallback',
  cpuCricketIdeal(cpu) === 'T20', cpuCricketIdeal(cpu));

// Behind -> score on the highest-value number the CPU has closed that an
// opponent has not (banking outranks continuing to close).
cpu = cricketState([
  { runs: 0, marks: [0, 0, 0, 0, 0, 3, 0] }, // CPU closed 20 only
  { runs: 10, marks: [0, 0, 0, 0, 0, 0, 0] } // opp nothing closed
]);
check('cricket: behind, 20 closed + open for opp -> bank T20 (60 pts) over the bull (50)',
  cpuCricketIdeal(cpu) === 'T20', cpuCricketIdeal(cpu));

cpu = cricketState([
  { runs: 0, marks: [0, 0, 0, 0, 0, 3, 3] }, // CPU closed 20 + bull
  { runs: 10, marks: [0, 0, 0, 0, 0, 0, 0] }
]);
check('cricket: behind, bull + 20 both scoring -> bull first in priority (BE)',
  cpuCricketIdeal(cpu) === 'BE', cpuCricketIdeal(cpu));

cpu = cricketState([
  { runs: 0, marks: [0, 0, 0, 0, 0, 3, 3] }, // CPU closed 20 + bull
  { runs: 10, marks: [0, 0, 0, 0, 0, 3, 0] } // opp closed 20 -> 20 dead
]);
check('cricket: behind, 20 closed by everyone -> bull is the only scoring number (BE)',
  cpuCricketIdeal(cpu) === 'BE', cpuCricketIdeal(cpu));

cpu = cricketState([
  { runs: 0, marks: [0, 0, 0, 0, 0, 3, 3] }, // CPU closed 20 + bull
  { runs: 10, marks: [0, 0, 0, 0, 0, 3, 3] } // opp too -> both dead
]);
check('cricket: behind, no scoring number left -> keep closing in priority order (T19)',
  cpuCricketIdeal(cpu) === 'T19', cpuCricketIdeal(cpu));

// Leading (or tied) -> close in bull-first order, 20 before nothing.
cpu = cricketState([
  { runs: 10, marks: [0, 0, 0, 0, 0, 3, 0] }, // leading, 20 closed, bull open
  { runs: 0, marks: [0, 0, 0, 0, 0, 0, 0] }
]);
check('cricket: leading, bull open before 19 -> aim the bulls-eye (bull first)',
  cpuCricketIdeal(cpu) === 'BE', cpuCricketIdeal(cpu));

console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURES');
process.exit(failures ? 1 : 0);
