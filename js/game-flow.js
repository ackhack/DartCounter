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

    if (name && !isDefaultPlayerName(name) && !playerNames.includes(name) && playerNames.length < 20) {
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

  // Assign each name a color: keep the stored one, otherwise take the first
  // palette color no one else in this game uses (keeps all players distinct;
  // >16 players wraps around). A stored color that collides with another
  // player this game gets reassigned and the map is updated.
  const usedColors = new Set();
  const roster = names.map((name, i) => {
    const key = name.toLowerCase();
    let color = playerColors[key];
    if (!color || usedColors.has(color)) {
      color = PLAYER_COLORS.find(c => !usedColors.has(c)) || PLAYER_COLORS[i % PLAYER_COLORS.length];
      playerColors[key] = color;
    }
    usedColors.add(color);
    return {
      id: i,
      name,
      color,
      score: state.x01Start,
      turns: 0,
      runs: 0,
      marks: {},
      finished: false,
      currentGamePosition: 0
    };
  });
  savePlayerColors(playerColors);

  //start game with default order
  initGame(roster);
}

function replayGame() {
  //clone players
  const names = [...state.players];

  // Sort players: loser first, winner last
  names.sort((a, b) => {
    return b.lastGamePosition - a.lastGamePosition;
  });

  // Manually start game with same settings but reordered players.
  // Color follows the player, not the position, across the reshuffle.
  initGame(names.map((p, i) => ({
    id: i,
    name: p.name,
    color: p.color,
    score: state.x01Start,
    turns: 0,
    runs: 0,
    marks: {},
    finished: false,
    currentGamePosition: 0
  })));
}

function initGame(players) {
  //cleanup last game
  $('#end-modal').classList.add('hidden');
  clearInput();

  // Initialize players
  state.players = players;

  // Initialize shanghai target progression
  state.shanghaiIndex = 0;
  state.shanghaiTurnsAtNumber = 0;

  // Initialize cricket marks
  const cricketSection = $('#cricket-marks-section');
  if (isCricket()) {
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

  // In cricket only 15-20 (and bull) are targetable — hide the rest and
  // reflow the grid to 3 columns so 15-20 form a tidy 2-row block.
  $$('.num-btn').forEach(btn => {
    btn.style.display = isCricket() && parseInt(btn.dataset.num) < 15 ? 'none' : '';
  });
  $('.number-grid').classList.toggle('cricket-grid', isCricket());

  // Cricket: single-column player cards (X01 keeps the multi-column grid).
  $('#players-list').classList.toggle('cricket-list', isCricket());

  // Quick-turn presets are X01 checkout combos — hide them in the other modes.
  $('#preset-section').style.display = (isCricket() || isShanghai()) ? 'none' : '';

  state.currentPlayerIndex = 0;
  state.throwCount = 0;
  state.round = 1;
  state.history = [];
  state.gameStarted = true;
  state.gameOver = false;
  state._currentPlayerTurn = null;

  showScreen('game');
  updateUndoButton();
  renderGame();
}

function backToSetup() {
  $('#end-modal').classList.add('hidden');
  state.gameStarted = false;
  state.gameOver = false;
  showScreen('setup');
}

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}