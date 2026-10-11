// ===========================
// DART COUNTER - Computer Opponent (X01)
// ===========================
'use strict';

// --- Dart knowledge ---

// Standard checkout chart, hardcoded — every score finishable in up to
// three darts (180 down to 1) mapped to the exact darts to throw. Source:
// https://www.dartsmatt.com/post/free-darts-checkout-chart-every-finish-from-170-dow
// adapted to this app's rules: no double-out (any dart landing exactly on 0
// finishes, see processX01Score), so 1 finishes with a single and 159/
// 162/165/168/171/174/177/180 (T20 T20 T11+) are included. Every other
// score (163, 166, 169, 172, 173, 175, 176, 178, 179 and 181+) cannot be
// finished in three darts — the CPU banks a T20 from those.
const CPU_CHECKOUT_CHART = {
  180: ['T20', 'T20', 'T20'],
  177: ['T20', 'T20', 'T19'],
  174: ['T20', 'T20', 'T18'],
  171: ['T20', 'T20', 'T17'],
  170: ['T20', 'T20', 'BE'],
  168: ['T20', 'T20', 'T16'],
  167: ['T20', 'T19', 'BE'],
  165: ['T20', 'T20', 'T15'],
  164: ['T20', 'T18', 'BE'],
  162: ['T20', 'T20', 'T14'],
  161: ['T20', 'T17', 'BE'],
  159: ['T20', 'T20', 'T13'],
  160: ['T20', 'T20', 'D20'],
  158: ['T20', 'T20', 'D19'],
  157: ['T20', 'T19', 'D20'],
  156: ['T20', 'T20', 'D18'],
  155: ['T20', 'T19', 'D19'],
  154: ['T20', 'T18', 'D20'],
  153: ['T20', 'T19', 'D18'],
  152: ['T20', 'T20', 'D16'],
  151: ['T20', 'T17', 'D20'],
  150: ['T20', 'T18', 'D18'],
  149: ['T20', 'T19', 'D16'],
  148: ['T20', 'T16', 'D20'],
  147: ['T20', 'T17', 'D18'],
  146: ['T20', 'T18', 'D16'],
  145: ['T20', 'T15', 'D20'],
  144: ['T20', 'T20', 'D12'],
  143: ['T20', 'T17', 'D16'],
  142: ['T20', 'T14', 'D20'],
  141: ['T20', 'T19', 'D12'],
  140: ['T20', 'T20', 'D10'],
  139: ['T20', 'T13', 'D20'],
  138: ['T20', 'T18', 'D12'],
  137: ['T20', 'T19', 'D10'],
  136: ['T20', 'T20', 'D8'],
  135: ['T20', 'T17', 'D12'],
  134: ['T20', 'T14', 'D16'],
  133: ['T20', 'T19', 'D8'],
  132: ['T20', 'T16', 'D12'],
  131: ['T20', 'T13', 'D16'],
  130: ['T20', 'T18', 'D8'],
  129: ['T19', 'T16', 'D12'],
  128: ['T18', 'T14', 'D16'],
  127: ['T20', 'T17', 'D8'],
  126: ['T19', 'T19', 'D6'],
  125: ['25', 'T20', 'D20'],
  124: ['T20', 'T16', 'D8'],
  123: ['T19', 'T16', 'D9'],
  122: ['T18', 'T20', 'D4'],
  121: ['T20', 'T11', 'D14'],
  120: ['T20', '20', 'D20'],
  119: ['T19', 'T10', 'D16'],
  118: ['T20', '18', 'D20'],
  117: ['T20', '17', 'D20'],
  116: ['T20', '16', 'D20'],
  115: ['T20', '15', 'D20'],
  114: ['T20', '14', 'D20'],
  113: ['T20', '13', 'D20'],
  112: ['T20', '12', 'D20'],
  111: ['T20', '11', 'D20'],
  110: ['T20', '10', 'D20'],
  109: ['T20', '9', 'D20'],
  108: ['T20', '8', 'D20'],
  107: ['T19', '18', 'D16'],
  106: ['T20', '6', 'D20'],
  105: ['T20', '5', 'D20'],
  104: ['T18', '18', 'D16'],
  103: ['T19', '10', 'D18'],
  102: ['T20', '10', 'D16'],
  101: ['T17', '10', 'D20'],
  100: ['T20', 'D20'],
  99: ['T19', '10', 'D16'],
  98: ['T20', 'D19'],
  97: ['T19', 'D20'],
  96: ['T20', 'D18'],
  95: ['T19', 'D19'],
  94: ['T18', 'D20'],
  93: ['T19', 'D18'],
  92: ['T20', 'D16'],
  91: ['T17', 'D20'],
  90: ['T18', 'D18'],
  89: ['T19', 'D16'],
  88: ['T20', 'D14'],
  87: ['T17', 'D18'],
  86: ['T18', 'D16'],
  85: ['T15', 'D20'],
  84: ['T20', 'D12'],
  83: ['T17', 'D16'],
  82: ['BE', 'D16'],
  81: ['T19', 'D12'],
  80: ['T20', 'D10'],
  79: ['T19', 'D11'],
  78: ['T18', 'D12'],
  77: ['T19', 'D10'],
  76: ['T20', 'D8'],
  75: ['T17', 'D12'],
  74: ['T14', 'D16'],
  73: ['T19', 'D8'],
  72: ['T16', 'D12'],
  71: ['T13', 'D16'],
  70: ['T18', 'D8'],
  69: ['T19', 'D6'],
  68: ['T20', 'D4'],
  67: ['T17', 'D8'],
  66: ['T10', 'D18'],
  65: ['25', 'D20'],
  64: ['T16', 'D8'],
  63: ['T13', 'D12'],
  62: ['T10', 'D16'],
  61: ['T15', 'D8'],
  60: ['20', 'D20'],
  59: ['19', 'D20'],
  58: ['18', 'D20'],
  57: ['17', 'D20'],
  56: ['16', 'D20'],
  55: ['15', 'D20'],
  54: ['14', 'D20'],
  53: ['13', 'D20'],
  52: ['20', 'D16'],
  51: ['19', 'D16'],
  50: ['18', 'D16'],
  49: ['17', 'D16'],
  48: ['16', 'D16'],
  47: ['15', 'D16'],
  46: ['6', 'D20'],
  45: ['13', 'D16'],
  44: ['12', 'D16'],
  43: ['11', 'D16'],
  42: ['10', 'D16'],
  41: ['9', 'D16'],
  40: ['D20'],
  39: ['7', 'D16'],
  38: ['D19'],
  37: ['5', 'D16'],
  36: ['D18'],
  35: ['3', 'D16'],
  34: ['D17'],
  33: ['1', 'D16'],
  32: ['D16'],
  31: ['15', 'D8'],
  30: ['D15'],
  29: ['13', 'D8'],
  28: ['D14'],
  27: ['11', 'D8'],
  26: ['D13'],
  25: ['9', 'D8'],
  24: ['D12'],
  23: ['7', 'D8'],
  22: ['D11'],
  21: ['5', 'D8'],
  20: ['D10'],
  19: ['3', 'D8'],
  18: ['D9'],
  17: ['1', 'D8'],
  16: ['D8'],
  15: ['7', 'D4'],
  14: ['D7'],
  13: ['5', 'D4'],
  12: ['D6'],
  11: ['3', 'D4'],
  10: ['D5'],
  9: ['1', 'D4'],
  8: ['D4'],
  7: ['3', 'D2'],
  6: ['D3'],
  5: ['1', 'D2'],
  4: ['D2'],
  3: ['1', 'D1'],
  2: ['D1'],
  1: ['1'],
};

// Points a throw token is worth, used to check a planned dart landed exactly.
function cpuDartValue(token) {
  if (token === 'Bull') return 25;
  if (token === 'BE') return 50;
  const m = token.match(/^([TD]?)(\d+)$/);
  const n = parseInt(m[2], 10);
  return m[1] === 'T' ? 3 * n : m[1] === 'D' ? 2 * n : n;
}

// --- Planned checkout for the CPU's current turn ---
//
// The chart is not self-consistent: the best remaining finish after a
// landed dart is sometimes a different row than the chart's own entry for
// that score (e.g. 170 = T20 T20 BE, but 110 is listed as T20 10 D20).
// Re-looking up chart[score] for every dart would break the CPU's own
// finish mid-turn, so it carries a plan — [score it was made for, darts
// still to throw] — and only re-plans when the score no longer matches
// (miss, error dart, bust, or undo).

let cpuPlan = null;

function cpuNextPlannedDart(player) {
  if (!cpuPlan || cpuPlan[0] !== player.score) {
    const finish = CPU_CHECKOUT_CHART[player.score];
    cpuPlan = finish ? [player.score, finish] : null;
  }
  return cpuPlan ? cpuPlan[1][0] : 'T20';
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

  const ideal = cpuNextPlannedDart(player);
  const hitChance = CPU_BASE_HIT_CHANCE +
    (CPU_MAX_HIT_CHANCE - CPU_BASE_HIT_CHANCE) * (state.cpuDifficulty / 100);
  const token = Math.random() < hitChance ? ideal : cpuErrorDart(ideal);

  const preScore = player.score;
  applyThrowToken(token);
  submitScore();

  // Advance the plan only when the planned dart landed exactly on target;
  // anything else (miss, error dart, bust) invalidates it and the next dart
  // replans from the chart.
  if (cpuPlan && token === ideal && preScore - player.score === cpuDartValue(ideal)) {
    const rest = cpuPlan[1].slice(1);
    cpuPlan = rest.length ? [player.score, rest] : null;
  } else {
    cpuPlan = null;
  }

  // Next dart of this turn — the guards above stop it after a bust or
  // finish, when throwCount is already SCORES_PER_TURN.
  maybeScheduleCpuDart();
}
