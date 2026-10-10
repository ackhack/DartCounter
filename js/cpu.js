// ===========================
// DART COUNTER - Computer Opponent (X01)
// ===========================
'use strict';

// --- Dart knowledge, precomputed once at load ---

// Every dart a player can throw, as a throw token + value.
const CPU_DARTS = [];
for (let n = 1; n <= 20; n++) {
  CPU_DARTS.push({ label: String(n), value: n, mult: 1 });
  CPU_DARTS.push({ label: 'T' + n, value: 3 * n, mult: 3 });
  CPU_DARTS.push({ label: 'D' + n, value: 2 * n, mult: 2 });
}
CPU_DARTS.push({ label: 'Bull', value: 25, mult: 1 });
CPU_DARTS.push({ label: 'BE', value: 50, mult: 2 });

// Game can only end on a double (or bullseye): value → finishing token.
const CPU_FINISH_BY_VALUE = {};
CPU_DARTS.filter(d => d.mult === 2).forEach(d => { CPU_FINISH_BY_VALUE[d.value] = d.label; });

// Scores that can still be finished within 2 more darts: either a single
// finishing dart, or any dart that leaves a finishing value.
const CPU_FINISH_VALUES = Object.keys(CPU_FINISH_BY_VALUE).map(Number);
const CPU_LEAVES_FINISH = new Set(CPU_FINISH_VALUES);
for (const a of CPU_DARTS) {
  for (const f of CPU_FINISH_VALUES) {
    CPU_LEAVES_FINISH.add(a.value + f);
  }
}

// Darts sorted by value descending — the CPU banks points when it can.
const CPU_DARTS_DESC = [...CPU_DARTS].sort((a, b) => b.value - a.value);

// The dart a perfect player would throw from `score`: the finishing dart if
// one exists, else the highest-scoring dart that leaves a 1-dart finish,
// else the treble 20. Score 1 is unfinishable in darts — throw a low double
// to bust out of the turn instead of looping on misses forever.
function cpuIdealX01Dart(score) {
  if (CPU_FINISH_BY_VALUE[score]) return CPU_FINISH_BY_VALUE[score];
  if (score <= CPU_MAX_CHECKOUT) {
    for (const d of CPU_DARTS_DESC) {
      const rem = score - d.value;
      if (rem > 0 && CPU_LEAVES_FINISH.has(rem)) return d.label;
    }
    // Only reachable from score 1 (no dart lands safely below it).
    return 'D1';
  }
  return 'T20';
}

// A botched version of the intended dart: mostly a miss, otherwise a single
// on (or near) the intended number.
function cpuErrorDart(ideal) {
  const roll = Math.random() * 100;
  if (roll < 45) return '0';
  if (ideal === 'Bull' || ideal === 'BE') {
    return roll < 85 ? 'Bull' : '0';
  }
  const n = parseInt(ideal.replace(/^[TD]/, ''), 10);
  if (roll < 75) return String(n);
  const offset = (1 + Math.floor(Math.random() * 3)) * (Math.random() < 0.5 ? -1 : 1);
  return String(Math.min(20, Math.max(1, n + offset)));
}

// The token for the CPU's next dart from the current score: the ideal dart
// with probability that scales with difficulty, otherwise an error dart.
function chooseCpuDart() {
  const player = state.players[state.currentPlayerIndex];
  const ideal = cpuIdealX01Dart(player.score);
  const hitChance = CPU_BASE_HIT_CHANCE +
    (CPU_MAX_HIT_CHANCE - CPU_BASE_HIT_CHANCE) * (state.cpuDifficulty / 100);
  return Math.random() < hitChance ? ideal : cpuErrorDart(ideal);
}

// --- Turn driver ---
// The CPU throws through applyThrowToken + submitScore (the same path as the
// DartIt bridge), so history, bust handling and undo all stay consistent. A
// single pending timer is cleared before re-arming, so undo or any other
// input can never double a throw.

let cpuTimer = null;

function clearCpuTurn() {
  if (cpuTimer) {
    clearTimeout(cpuTimer);
    cpuTimer = null;
  }
}

// Re-arm the CPU when it is a CPU player's turn and the turn is not already
// complete. Safe to call after any game-state change; it only acts for CPU
// players and stays idle during the 3s turn-advance delay (throwCount is
// still SCORES_PER_TURN then).
function maybeScheduleCpuDart() {
  clearCpuTurn();
  if (!state.gameStarted || state.gameOver) return;
  const player = state.players[state.currentPlayerIndex];
  if (!player || !player.isCpu || player.finished) return;
  if (state.throwCount >= SCORES_PER_TURN) return;
  cpuTimer = setTimeout(() => {
    cpuTimer = null;
    cpuThrowDart();
  }, CPU_THINK_DELAY);
}

function cpuThrowDart() {
  // Re-validate: the state may have changed while the timer was pending
  // (undo, end game, back to setup).
  if (!state.gameStarted || state.gameOver) return;
  const player = state.players[state.currentPlayerIndex];
  if (!player || !player.isCpu || player.finished) return;
  if (state.throwCount >= SCORES_PER_TURN) return;

  applyThrowToken(chooseCpuDart());
  submitScore();

  // Next dart of this turn — the guards above stop it after a bust or
  // finish, when throwCount is already SCORES_PER_TURN.
  maybeScheduleCpuDart();
}
