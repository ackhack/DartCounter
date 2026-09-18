// ===========================
// DART COUNTER - Game Flow
// ===========================
'use strict';

function startGame() {
  const inputs = $$('.name-input');
  const names = [];

  for (let i = 0; i < inputs.length; i++) {
    const name = inputs[i].value.trim() || `Player ${i + 1}`;
    names.push(name);

    // Save new names to localStorage for future suggestions (skip generated defaults like "Player 1")
    if (name && !/^Player \d+$/.test(name) && !playerNames.includes(name) && playerNames.length < 20) {
      playerNames.push(name);
      savePlayerNames();
      renderPlayerSuggestions();
    }
  }

  // Reject duplicate names (case-insensitive) — name-keyed aggregates
  // (stats entries, the modal's per-name best-turn map) would collide.
  const seen = new Set();
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) {
      alert(`Duplicate player name: "${name}" — every player needs a unique name.`);
      return;
    }
    seen.add(key);
  }

  // Initialize players
  state.players = names.map((name, i) => ({
    id: i,
    name,
    score: state.x01Start,
    turns: 0,
    runs: 0,
    marks: {},
    finished: false
  }));

  // Initialize cricket marks
  if (state.mode === 'cricket') {
    state.players.forEach(p => {
      p.marks = {};
      CRICKET_NUMBERS.forEach(n => p.marks[n] = 0);
      p.marks['bull'] = 0;
    });
  }

  state.currentPlayerIndex = 0;
  state.throwCount = 0;
  state.round = 1;
  state.history = [];
  state.gameStarted = true;
  state.gameOver = false;

  // Reset input — a game-winning dart leaves its number selected, and a
  // stale selection would be instant-scored by the first multiplier click
  clearInput();

  showScreen('game');
  highlightCricketTargets();
  renderGame();
}

function backToSetup() {
  $('#end-modal').classList.add('hidden');
  state.gameStarted = false;
  state.gameOver = false;
  clearGameState();
  showScreen('setup');
}

function replayGame() {
  const names = [...state.players];

  // Sort players: loser first, winner last
  names.sort((a, b) => {
    if (a.finished && !b.finished) return -1;
    if (!a.finished && b.finished) return 1;
    // X01: higher remaining score = worse, comes first
    // Cricket: lower runs = worse, comes first
    if (state.mode === 'x01') return b.score - a.score;
    return a.runs - b.runs;
  });

  const sortedNames = names.map(p => p.name);

  const mode = state.mode;
  const x01Start = state.x01Start;

  $('#end-modal').classList.add('hidden');
  clearGameState();

  // Manually start game with same settings but reordered players
  state.players = sortedNames.map((name, i) => ({
    id: i,
    name,
    score: x01Start,
    turns: 0,
    runs: 0,
    marks: {},
    finished: false
  }));

  // Initialize cricket marks
  if (mode === 'cricket') {
    state.players.forEach(p => {
      p.marks = {};
      CRICKET_NUMBERS.forEach(n => p.marks[n] = 0);
      p.marks['bull'] = 0;
    });
  }

  state.currentPlayerIndex = 0;
  state.throwCount = 0;
  state.round = 1;
  state.history = [];
  state.gameStarted = true;
  state.gameOver = false;
  state._currentPlayerTurn = null;

  // Reset input — a game-winning dart leaves its number selected
  clearInput();

  showScreen('game');
  highlightCricketTargets();
  renderGame();
}

function newGame() {
  $('#end-modal').classList.add('hidden');
  clearGameState();
  state.gameStarted = false;
  state.gameOver = false;

  // Reset input
  clearInput();

  showScreen('setup');
}

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}
