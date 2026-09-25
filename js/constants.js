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
const PLAYER_COLORS = [
  '#f87171', // red
  '#fb923c', // orange
  '#fbbf24', // amber
  '#facc15', // yellow
  '#a3e635', // lime
  '#4ade80', // green
  '#34d399', // emerald
  '#2dd4bf', // teal
  '#22d3ee', // cyan
  '#38bdf8', // sky
  '#60a5fa', // blue
  '#818cf8', // indigo
  '#a78bfa', // violet
  '#c084fc', // purple
  '#e879f9', // fuchsia
  '#f472b6'  // pink
];
const CRICKET_NUMBERS = [15, 16, 17, 18, 19, 20, 25];
const BULL_NUMBER = 25;
const CRICKET_TARGET_MARKS = 3;
const MIN_PLAYERS = 2;
const SCORES_PER_TURN = 3;
const MAX_X01_TURN = 180;

function isX01() {
  return state.mode === 'x01';
}

function isCricket() {
  return state.mode === 'cricket';
}

function cricketAllPlayersClosed(value) {
  return state.players.every(p => (p.marks[value] || 0) >= CRICKET_TARGET_MARKS);
}