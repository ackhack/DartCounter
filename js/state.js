// ===========================
// DART COUNTER - State & DOM References
// ===========================
'use strict';

let state = {
  mode: 'x01',           // 'x01', 'cricket' or 'shanghai'
  x01Start: 301,
  cpuDifficulty: 50,     // 0-100, computer opponent
  players: [],           // [{id, name, score, turns, runs, marks, finished}]
  currentPlayerIndex: 0,
  throwCount: 0,         // 0-2 within current turn
  round: 1,
  history: [],           // [{round, playerId, name, throws, total}]
  throwLog: [],          // append-only: [{label, color}] every inputted dart (undo never touches it)
  gameStarted: false,
  gameOver: false,
  _currentPlayerTurn: null,  // transient: tracks in-progress 3-dart turn
  shanghaiIndex: 0,      // 0-20: current target in SHANGHAI_TARGETS
  shanghaiTurnsAtNumber: 0 // completed turns at the current shanghai target
};

let input = {
  number: null,
  multiplier: 1,
  special: null,
  selected: false,
  hit: null  // where the dart actually landed ({ r, angle, field, ideal }), set by CPU/DartIt before submitScore
};

let stats = loadStats();
let playerColors = loadPlayerColors();

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const screens = {
  setup: $('#setup-screen'),
  game: $('#game-screen'),
  stats: $('#stats-screen')
};

let playerNames = loadPlayerNames();
