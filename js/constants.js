// ===========================
// DART COUNTER - Constants
// ===========================
'use strict';

const STORAGE_KEY_NAMES = 'dartcounter_player_names';
const STORAGE_KEY_STATS = 'dartcounter_stats';
const STORAGE_KEY_GAME = 'dartcounter_game';
const STORAGE_KEY_COLORS = 'dartcounter_player_colors';

// 16 visually distinct hues, all light enough to read as text on the dark
// navy background. Assignment is stable per player name (see startFirstGame).
// Ordered so the top colors are maximally distinct from each other — the
// usual 2–4 player games get the most different hues, similar hues only
// appear together in 8+ player games.
const PLAYER_COLORS = [
  '#60a5fa', // blue
  '#4ade80', // green
  '#facc15', // yellow
  '#f87171', // red
  '#e879f9', // fuchsia
  '#a78bfa', // violet
  '#a3e635', // lime
  '#f472b6', // pink
  '#fb923c', // orange
  '#2dd4bf', // teal
  '#38bdf8', // sky
  '#fbbf24', // amber
  '#22d3ee', // cyan
  '#34d399', // emerald
  '#818cf8', // indigo
  '#c084fc'  // purple
];
const CRICKET_NUMBERS = [15, 16, 17, 18, 19, 20, 25];
const BULL_NUMBER = 25;
const CRICKET_TARGET_MARKS = 3;
// Shanghai 21: every number 1-20 in order, then the bull as the 21st target.
const SHANGHAI_TARGETS = [];
for (let i = 1; i <= 20; i++) SHANGHAI_TARGETS.push(i);
SHANGHAI_TARGETS.push(BULL_NUMBER);
const MIN_PLAYERS = 2;
const SCORES_PER_TURN = 3;
const MAX_X01_TURN = 180;
// Seconds to show the game-over results before the next game auto-starts.
const AUTO_RESTART_DELAY = 10;

// Computer opponent (X01 only) — difficulty 0-100 maps to the chance that
// an intended dart actually lands: 0 → 20%, 100 → 98%.
const CPU_BASE_HIT_CHANCE = 0.20;
const CPU_MAX_HIT_CHANCE = 0.98;
// Pause before the CPU throws each dart, so its turn is watchable.
const CPU_THINK_DELAY = 1000;
// Highest score with a 3-dart checkout (MAX_X01_TURN itself needs 180 in one
// turn, which only 3×T20 provides and can't be finished).
const CPU_MAX_CHECKOUT = 170;

function isX01() {
  return state.mode === 'x01';
}

function isCricket() {
  return state.mode === 'cricket';
}

function isShanghai() {
  return state.mode === 'shanghai';
}

function currentShanghaiTarget() {
  return SHANGHAI_TARGETS[state.shanghaiIndex];
}

// Generated placeholder names ("Player 1", "Player 2", ...) are anonymous:
// they must not land in the persistent stats nor prefill the setup screen.
function isDefaultPlayerName(name) {
  return /^Player \d+$/.test(name);
}

function cricketAllPlayersClosed(value) {
  return state.players.every(p => (p.marks[value] || 0) >= CRICKET_TARGET_MARKS);
}