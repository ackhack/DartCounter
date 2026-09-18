// ===========================
// DART COUNTER - Game Flow
// ===========================
'use strict';

function startFirstGame() {
  const inputs = $$('.name-input');
  const names = [];

  // Save new names to localStorage for future suggestions (skip generated defaults like "Player 1")
  for (let i = 0; i < inputs.length; i++) {
    const name = inputs[i].value.trim() || `Player ${i + 1}`;
    names.push(name);

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

  //start game with default order
  initGame(names.map((name, i) => ({
    id: i,
    name,
    score: state.x01Start,
    turns: 0,
    runs: 0,
    marks: {},
    finished: false
  })));
}

function replayGame() {
  //clone players
  const names = [...state.players];

  // Sort players: loser first, winner last
  names.sort((a, b) => {
    return b.lastGamePosition - a.lastGamePosition;
  });

  // Manually start game with same settings but reordered players
  initGame(names.map((p, i) => ({
    id: i,
    name: p.name,
    score: state.x01Start,
    turns: 0,
    runs: 0,
    marks: {},
    finished: false
  })));
}

function initGame(players) {
  //cleanup last game
  $('#end-modal').classList.add('hidden');
  clearGameState();
  clearInput();

  // Initialize players
  state.players = players;

  // Initialize cricket marks
  const cricketSection = $('#cricket-marks-section');
  if (state.mode === 'cricket') {
    state.players.forEach(p => {
      p.marks = {};
      CRICKET_NUMBERS.forEach(n => p.marks[n] = 0);
    });

    cricketSection.style.display = 'grid';
    CRICKET_NUMBERS.forEach(n => {
      const el = $(`#marks-${n}`);
      if (el) {
        const numEl = el.querySelector('.mark-num');
        if (numEl) {
          numEl.classList.remove('closed');
        }
      }
    });
  } else {
    cricketSection.style.display = 'none';
  }

  state.currentPlayerIndex = 0;
  state.throwCount = 0;
  state.round = 1;
  state.history = [];
  state.gameStarted = true;
  state.gameOver = false;
  state._currentPlayerTurn = null;

  showScreen('game');
  renderGame();
}

function backToSetup() {
  $('#end-modal').classList.add('hidden');
  state.gameStarted = false;
  state.gameOver = false;
  clearGameState();
  showScreen('setup');
}

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}