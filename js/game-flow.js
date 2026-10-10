// ===========================
// DART COUNTER - Game Flow
// ===========================
'use strict';

// Generated CPU name that doesn't collide with names already taken.
function autoCpuName(seen) {
  let n = 1;
  let name = 'CPU';
  while (seen.has(name.toLowerCase())) name = 'CPU ' + (++n);
  return name;
}

function startFirstGame() {
  const rows = $$('.name-input-wrapper');

  // Collect names + CPU flags. Empty CPU rows get generated "CPU" / "CPU 2"
  // / ... names that can't collide with what was typed.
  const players = [];
  const seen = new Set();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const isCpu = !!row.querySelector('.cpu-toggle-btn.active');
    const typed = row.querySelector('.name-input').value.trim();
    const name = typed || (isCpu ? autoCpuName(seen) : `Player ${i + 1}`);

    // Reject duplicate names (case-insensitive) — name-keyed aggregates
    // (stats entries, the modal's per-name best-turn map) would collide.
    const key = name.toLowerCase();
    if (seen.has(key)) {
      alert(`Duplicate player name: "${name}" — every player needs a unique name.`);
      return;
    }
    seen.add(key);
    players.push({ name, isCpu });

    // Save new names to localStorage for future suggestions (skip generated
    // defaults like "Player 1" and auto-generated "CPU" names).
    if (typed && !isDefaultPlayerName(name) && !playerNames.includes(name) && playerNames.length < 20) {
      playerNames.push(name);
      savePlayerNames();
      renderPlayerSuggestions();
    }
  }

  // Assign each name a color: keep the stored one, otherwise take the first
  // palette color no saved player uses (colors stay unique across all of
  // localStorage, not just this game; >16 players wraps around). A stored
  // color another saved player already has gets reassigned and the map is
  // updated.
  const usedColors = new Set(Object.values(playerColors));
  const roster = players.map(({ name, isCpu }, i) => {
    const key = name.toLowerCase();
    let color = playerColors[key];
    // Collides if any *other* saved player has this color; the map is updated
    // as we go, so this also covers players earlier in this roster.
    const collides = color && Object.entries(playerColors).some(([k, c]) => k !== key && c === color);
    if (!color || collides) {
      color = PLAYER_COLORS.find(c => !usedColors.has(c)) || PLAYER_COLORS[i % PLAYER_COLORS.length];
      playerColors[key] = color;
      usedColors.add(color);
    }
    return {
      id: i,
      name,
      color,
      score: state.x01Start,
      turns: 0,
      runs: 0,
      marks: {},
      finished: false,
      currentGamePosition: 0,
      isCpu
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
  // Color and the CPU flag follow the player, not the position, across the
  // reshuffle.
  initGame(names.map((p, i) => ({
    id: i,
    name: p.name,
    color: p.color,
    score: state.x01Start,
    turns: 0,
    runs: 0,
    marks: {},
    finished: false,
    currentGamePosition: 0,
    isCpu: p.isCpu
  })));
}

function initGame(players) {
  //cleanup last game
  $('#end-modal').classList.add('hidden');
  clearInput();
  clearAutoRestart();
  clearCpuTurn();

  // Initialize players
  state.players = players;

  // Initialize shanghai target progression
  state.shanghaiIndex = 0;
  state.shanghaiTurnsAtNumber = 0;

  // Initialize cricket marks
  if (isCricket()) {
    state.players.forEach(p => {
      p.marks = {};
      CRICKET_NUMBERS.forEach(n => p.marks[n] = 0);
    });
  }

  // In cricket only 15-20 (and bull) are targetable — hide the rest and
  // reflow the grid to 3 columns so 15-20 form a tidy 2-row block.
  $$('.num-btn').forEach(btn => {
    btn.style.display = isCricket() && parseInt(btn.dataset.num) < 15 ? 'none' : '';
  });
  $('.number-grid').classList.toggle('cricket-grid', isCricket());

  // Cricket: the scoreboard replaces the player list entirely (names, marks
  // and points all live in the grid), so hide the list and let the grid take
  // its full height.
  $('#players-list').style.display = isCricket() ? 'none' : '';
  $('#cricket-marks-grid').style.display = isCricket() ? '' : 'none';
  $('#active-player-score').style.display = isCricket() ? 'none' : '';

  // Quick-turn presets are X01 checkout combos — hide them in the other modes.
  $('#preset-section').style.display = (isX01()) ? '' : 'none';

  state.currentPlayerIndex = 0;
  state.throwCount = 0;
  state.round = 1;
  state.history = [];
  state.throwLog = [];
  state.gameStarted = true;
  state.gameOver = false;
  state._currentPlayerTurn = null;

  showScreen('game');
  updateUndoButton();
  renderGame();

  // If the first player is the computer, start its turn.
  maybeScheduleCpuDart();
}

function backToSetup() {
  $('#end-modal').classList.add('hidden');
  clearAutoRestart();
  clearCpuTurn();
  state.gameStarted = false;
  state.gameOver = false;
  showScreen('setup');
}

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}