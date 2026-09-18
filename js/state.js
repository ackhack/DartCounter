// ===========================
// DART COUNTER - State & DOM References
// ===========================
'use strict';

let state = {
  mode: 'x01',           // 'x01' or 'cricket'
  x01Start: 301,
  players: [],           // [{id, name, score, turns, runs, marks, finished}]
  currentPlayerIndex: 0,
  throwCount: 0,         // 0-2 within current turn
  round: 1,
  history: [],           // [{round, playerId, name, throws, total}]
  gameStarted: false,
  gameOver: false,
  _currentPlayerTurn: null  // transient: tracks in-progress 3-dart turn
};

let input = {
  number: null,
  multiplier: 1,
  special: null,
  selected: false
};

let stats = loadStats();

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const screens = {
  setup: $('#setup-screen'),
  game: $('#game-screen'),
  stats: $('#stats-screen')
};

let playerNames = loadPlayerNames();
