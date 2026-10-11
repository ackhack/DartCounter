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
  140: ['T20', 'T20', '20'],
  139: ['T20', 'T13', 'D20'],
  138: ['T20', 'T18', 'D12'],
  137: ['T20', 'T19', '20'],
  136: ['T20', 'T20', '16'],
  135: ['T20', 'T17', 'D12'],
  134: ['T20', 'T14', 'D16'],
  133: ['T20', 'T19', '16'],
  132: ['T20', 'T16', 'D12'],
  131: ['T20', 'T13', 'D16'],
  130: ['T20', 'T18', '16'],
  129: ['T19', 'T16', 'D12'],
  128: ['T18', 'T14', 'D16'],
  127: ['T20', 'T17', '16'],
  126: ['T19', 'T19', '12'],
  125: ['25', 'T20', 'D20'],
  124: ['T20', 'T16', '16'],
  123: ['T19', 'T16', '18'],
  122: ['T18', 'T20', '8'],
  121: ['T20', 'T11', 'D14'],
  120: ['T20', 'T20'],
  119: ['T20', '19', 'D20'],
  118: ['T20', '18', 'D20'],
  117: ['T20', 'T19'],
  116: ['T20', 'T17', '5'],
  115: ['T20', 'T15', '10'],
  114: ['T20', 'T18'],
  113: ['T20', 'T17', '2'],
  112: ['T20', 'T16', '4'],
  111: ['T20', 'T17'],
  110: ['T20', 'BE'],
  109: ['T20', 'T16', '1'],
  108: ['T20', 'T16'],
  107: ['T19', 'BE'],
  106: ['T20', '6', 'D20'],
  105: ['T20', 'T15'],
  104: ['T18', 'BE'],
  103: ['T20', 'T14', '1'],
  102: ['T20', 'T14'],
  101: ['T17', 'BE'],
  100: ['T20', 'D20'],
  99: ['T20', 'T13'],
  98: ['T20', 'D19'],
  97: ['T19', 'D20'],
  96: ['T20', 'D18'],
  95: ['T19', 'D19'],
  94: ['T20', 'D17'],
  93: ['T20', 'T11'],
  92: ['T20', 'D16'],
  91: ['T17', 'D20'],
  90: ['T20', 'D15'],
  89: ['T19', 'D16'],
  88: ['T20', 'D14'],
  87: ['T20', 'T9'],
  86: ['T20', 'D13'],
  85: ['T20', 'Bull'],
  84: ['T20', 'D12'],
  83: ['T17', 'D16'],
  82: ['T20', 'D11'],
  81: ['T20', 'T7'],
  80: ['T20', '20'],
  79: ['T20', '19'],
  78: ['T20', '18'],
  77: ['T20', '17'],
  76: ['T20', '16'],
  75: ['T20', '15'],
  74: ['T20', '14'],
  73: ['T20', '13'],
  72: ['T20', '12'],
  71: ['T20', '11'],
  70: ['T20', '10'],
  69: ['T20', '9'],
  68: ['T20', '8'],
  67: ['T20', '7'],
  66: ['T20', '6'],
  65: ['T20', '5'],
  64: ['T20', '4'],
  63: ['T20', '3'],
  62: ['T20', '2'],
  61: ['T20', '1'],
  60: ['T20'],
  59: ['19', 'D20'],
  58: ['18', 'D20'],
  57: ['T19'],
  56: ['T17', '5'],
  55: ['T15', '10'],
  54: ['T18'],
  53: ['T17', '2'],
  52: ['T16', '4'],
  51: ['T17'],
  50: ['BE'],
  49: ['T16', '1'],
  48: ['T16'],
  47: ['T14', '5'],
  46: ['T13', '7'],
  45: ['T15'],
  44: ['T14', '2'],
  43: ['T14', '1'],
  42: ['T14'],
  41: ['T11', '8'],
  40: ['D20'],
  39: ['T13'],
  38: ['D19'],
  37: ['17', '20'],
  36: ['D18'],
  35: ['15', '20'],
  34: ['D17'],
  33: ['T11'],
  32: ['D16'],
  31: ['11', '20'],
  30: ['D15'],
  29: ['9', '20'],
  28: ['D14'],
  27: ['T9'],
  26: ['D13'],
  25: ['Bull'],
  24: ['D12'],
  23: ['3', '20'],
  22: ['D11'],
  21: ['T7'],
  20: ['20'],
  19: ['19'],
  18: ['18'],
  17: ['17'],
  16: ['16'],
  15: ['15'],
  14: ['14'],
  13: ['13'],
  12: ['12'],
  11: ['11'],
  10: ['10'],
  9: ['9'],
  8: ['8'],
  7: ['7'],
  6: ['6'],
  5: ['4'],
  4: ['4'],
  3: ['3'],
  2: ['2'],
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
  const hit = cpuAimHit(ideal, state.cpuDifficulty);
  const token = hit.field;

  const preScore = player.score;
  applyThrowToken(token);
  submitScore();

  // Record where this dart actually landed so the hit coordinates can be
  // shown per player at the end of the game (aggregated from history). The
  // turn may have just been pushed to history (3rd dart, bust or checkout).
  const turn = state._currentPlayerTurn || state.history[state.history.length - 1];
  recordDartHit(turn, { r: hit.r, angle: hit.angle, field: hit.field, ideal: ideal });

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
