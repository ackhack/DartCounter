// ===========================
// DART COUNTER - Constants
// ===========================
'use strict';

const STORAGE_KEY_NAMES = 'dartcounter_player_names';
const STORAGE_KEY_STATS = 'dartcounter_stats';
const STORAGE_KEY_GAME = 'dartcounter_game';
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