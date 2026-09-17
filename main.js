// ===========================
// DART COUNTER - Main Application
// ===========================

(() => {
  'use strict';

  // ===========================
  // CONSTANTS
  // ===========================
  const STORAGE_KEY_STATS = 'dartcounter_stats';
  const STORAGE_KEY_GAME = 'dartcounter_game';
  const CRICKET_NUMBERS = [15, 16, 17, 18, 19, 20];
  const CRICKET_TARGET_MARKS = 3;
  const X01_OPTIONS = [301, 501, 701];
  const MIN_PLAYERS = 2;
  const SCORES_PER_TURN = 3;
  const STORAGE_KEY_NAMES = 'dartcounter_player_names';
  const MAX_X01_TURN = 180;  // 3×T20 — highest possible single X01 turn score; a turn started from this or less was a checkout opportunity

  // ===========================
  // STATE
  // ===========================
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

  // ===========================
  // DOM REFERENCES
  // ===========================
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const screens = {
    setup: $('#setup-screen'),
    game: $('#game-screen'),
    stats: $('#stats-screen')
  };

  let playerNames = loadPlayerNames();

  // ===========================
  // INITIALIZATION
  // ===========================
  function init() {
    setupEventListeners();
    renderPlayerSuggestions();
    renderNameInputs(3);
    updateNameInputs();
    tryRegisterSW();
  }

  function tryRegisterSW() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
          .then(() => console.log('SW registered'))
          .catch(() => console.log('SW registration skipped'));
      });
    }
  }

  // ===========================
  // LOCAL STORAGE
  // ===========================
  function loadStats() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_STATS);
      const parsed = data ? JSON.parse(data) : { players: {}, games: [] };
      if (parsed.players) {
        for (const key of Object.keys(parsed.players)) {
          const entry = parsed.players[key];
          // Migrate legacy flat entries to the per-mode structure.
          // The mode of old games is unrecoverable, so attribute them to X01.
          // Legacy totalTurns accumulated per-dart counts (player.turns increments per dart).
          // Legacy bestTurn stored the max of per-game total runs (a bug, never a
          // single-turn score); the per-turn data is gone, so drop it.
          if (entry && !entry.modes) {
            entry.modes = {
              x01: {
                ...emptyModeStats(),
                gamesPlayed: entry.gamesPlayed || 0,
                wins: entry.wins || 0,
                totalRuns: entry.totalRuns || 0,
                totalDarts: entry.totalTurns || 0,
                bestScore: entry.bestScore || 0
              },
              cricket: emptyModeStats()
            };
            delete entry.gamesPlayed;
            delete entry.wins;
            delete entry.totalRuns;
            delete entry.totalTurns;
            delete entry.bestTurn;
            delete entry.bestScore;
            computeModeAverages(entry.modes.x01);
          }
        }
        // One-time repair for stats written before the per-turn bestTurn fix:
        // bestTurn then stored the player's total runs per game, so any X01
        // value above the max single-turn score is definitely corrupt. Reset
        // it so the stat rebuilds from new games instead of staying pinned.
        for (const entry of Object.values(parsed.players)) {
          const x01 = entry && entry.modes && entry.modes.x01;
          if (x01 && x01.bestTurn > MAX_X01_TURN) x01.bestTurn = 0;
        }
      }
      return parsed;
    } catch {
      return { players: {}, games: [] };
    }
  }

  function loadPlayerNames() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_NAMES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  function savePlayerNames() {
    try {
      localStorage.setItem(STORAGE_KEY_NAMES, JSON.stringify(playerNames));
    } catch (e) {
      console.warn('Failed to save player names:', e);
    }
  }

  function saveStats() {
    try {
      localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(stats));
    } catch (e) {
      console.warn('Failed to save stats:', e);
    }
  }

  function saveGameState() {
    try {
      localStorage.setItem(STORAGE_KEY_GAME, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save game state:', e);
    }
  }

  function loadGameState() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_GAME);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && parsed.gameStarted && !parsed.gameOver) {
          state = parsed;
          return true;
        }
      }
    } catch (e) {
      console.warn('Failed to load game state:', e);
    }
    return false;
  }

  function clearGameState() {
    try {
      localStorage.removeItem(STORAGE_KEY_GAME);
    } catch (e) {
      console.warn('Failed to clear game state:', e);
    }
  }

  function emptyModeStats() {
    return {
      gamesPlayed: 0,
      wins: 0,
      totalRuns: 0,
      totalTurns: 0,
      totalDarts: 0,
      maxDarts: 0,
      bestTurn: 0,
      bestScore: 0,  // X01: lowest remaining score
      checkoutAttempts: 0,
      checkouts: 0,
      bullDarts: 0,
      avgPerTurn: 0,
      avgPerGame: 0,
      winRate: 0,
      checkoutPct: 0
    };
  }

  function computeModeAverages(m) {
    m.avgPerTurn = m.totalTurns > 0 ? Math.round(m.totalRuns / m.totalTurns * 10) / 10 : 0;
    m.avgPerGame = m.gamesPlayed > 0 ? Math.round(m.totalRuns / m.gamesPlayed * 10) / 10 : 0;
    m.winRate = m.gamesPlayed > 0 ? Math.round(m.wins / m.gamesPlayed * 100) : 0;
    m.checkoutPct = m.checkoutAttempts > 0 ? Math.round(m.checkouts / m.checkoutAttempts * 100) : 0;
  }

  // Derived from history so undo can't skew the counts.
  // A turn started from score <= MAX_X01_TURN (3 darts can always finish it)
  // was a checkout opportunity; the finishing turn is the player's last
  // history entry.
  function computeX01CheckoutStats(player) {
    const entries = state.history.filter(h => h.playerId === player.id);
    if (entries.length === 0) return { attempts: 0, made: 0 };
    let afterScore = player.score;
    let attempts = 0;
    let made = 0;
    for (let i = entries.length - 1; i >= 0; i--) {
      const startScore = afterScore + entries[i].total;
      if (startScore <= MAX_X01_TURN) {
        attempts++;
        if (i === entries.length - 1 && player.finished) made++;
      }
      afterScore = startScore;
    }
    return { attempts, made };
  }

  function countBullDarts(player) {
    let count = 0;
    for (const h of state.history) {
      if (h.playerId !== player.id) continue;
      for (const t of h.throws) {
        if (t === 'Bull' || t === 'BE') count++;
      }
    }
    return count;
  }

  function updatePlayerStats(player, isWinner) {
    const key = player.name.toLowerCase();
    if (!stats.players[key]) {
      stats.players[key] = { name: player.name, modes: { x01: emptyModeStats(), cricket: emptyModeStats() } };
    }
    const m = stats.players[key].modes[state.mode];
    const entries = state.history.filter(h => h.playerId === player.id);

    m.gamesPlayed++;
    if (isWinner) m.wins++;
    m.totalRuns += player.runs;
    m.totalTurns += entries.length;
    m.totalDarts += player.turns;
    if (player.turns > m.maxDarts) m.maxDarts = player.turns;
    // Best single turn this game (busted X01 turns total 0 by history accounting)
    const playerBestTurn = entries.reduce((max, h) => Math.max(max, h.total || 0), 0);
    if (playerBestTurn > m.bestTurn) m.bestTurn = playerBestTurn;
    if (state.mode === 'x01' && player.score >= 0 && (m.bestScore === 0 || player.score < m.bestScore)) {
      m.bestScore = player.score;
    }
    m.bullDarts += countBullDarts(player);
    if (state.mode === 'x01') {
      const co = computeX01CheckoutStats(player);
      m.checkoutAttempts += co.attempts;
      m.checkouts += co.made;
    }
    computeModeAverages(m);
    saveStats();
  }

  function saveGameToHistory(result) {
    stats.games.push({
      date: Date.now(),
      mode: state.mode,
      x01Start: state.mode === 'x01' ? state.x01Start : null,
      players: state.players.map(p => ({ name: p.name, finished: p.finished, runs: p.runs })),
      winner: result.winner,
      results: result.results
    });
    // Keep last 50 games
    if (stats.games.length > 50) {
      stats.games = stats.games.slice(-50);
    }
    saveStats();
  }

  // ===========================
  // EVENT LISTENERS
  // ===========================
  function setupEventListeners() {
    // Mode selection
    $$('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.mode = btn.dataset.mode;
        updateSetupVisibility();
      });
    });

    // X01 score selection
    $$('.score-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.score-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.x01Start = parseInt(btn.dataset.score);
      });
    });

    // Player count (quick shortcuts — the real roster is whatever rows exist)
    $$('.count-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        renderNameInputs(parseInt(btn.dataset.count));
        updateNameInputs();
      });
    });

    // Add player (no upper limit)
    $('#add-player-btn').addEventListener('click', addPlayerRow);

    // Start game
    $('#start-game-btn').addEventListener('click', startGame);

    // Stats screen
    $('#view-stats-btn').addEventListener('click', () => {
      renderStatsScreen();
      showScreen('stats');
    });
    $('#stats-back-btn').addEventListener('click', () => showScreen('setup'));

    // End game buttons
    $('#back-btn').addEventListener('click', backToSetup);
    // Manual end is destructive (finalizes stats) — confirm. The automatic
    // game-over path in submitScore is the real finish and stays unguarded.
    $('#end-game-btn').addEventListener('click', () => {
      if (confirm('End this game now? Current scores will be finalized and saved to stats.')) endGame();
    });
    $('#replay-btn').addEventListener('click', replayGame);
    $('#new-game-btn').addEventListener('click', newGame);
    $('#back-to-setup-btn').addEventListener('click', backToSetup);

    // Number buttons
    $$('.num-btn').forEach(btn => {
      btn.addEventListener('click', () => selectNumber(parseInt(btn.dataset.num)));
    });

    // Multiplier buttons
    $$('.mult-btn').forEach(btn => {
      btn.addEventListener('click', () => selectMultiplier(parseInt(btn.dataset.mult)));
    });

    // Special buttons
    $$('.special-btn').forEach(btn => {
      btn.addEventListener('click', () => selectSpecial(btn.dataset.special));
    });

    // Submit / Undo
    $('#undo-btn').addEventListener('click', undoLast);
  }

  function updateSetupVisibility() {
    const x01Opts = $('#x01-options');
    if (x01Opts) {
      x01Opts.style.display = state.mode === 'x01' ? 'flex' : 'none';
    }
  }

  function renderPlayerSuggestions() {
    const datalist = $('#player-name-suggestions');
    datalist.innerHTML = '';
    playerNames.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      datalist.appendChild(option);
    });
  }

  function createPlayerRow(i) {
    const wrapper = document.createElement('div');
    wrapper.className = 'name-input-wrapper';
    wrapper.innerHTML = `
      <span class="player-number">${i + 1}</span>
      <input type="text" class="name-input" data-index="${i}" placeholder="Player ${i + 1}" maxlength="12" list="player-name-suggestions">
      <button class="remove-player-btn" title="Remove player">✕</button>
    `;
    wrapper.querySelector('.remove-player-btn').addEventListener('click', () => removePlayerRow(wrapper));
    return wrapper;
  }

  function renderNameInputs(count) {
    const container = $('#name-inputs');
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
      container.appendChild(createPlayerRow(i));
    }
    syncCountButtons(count);
    updateRemoveButtons();
  }

  function addPlayerRow() {
    const container = $('#name-inputs');
    container.appendChild(createPlayerRow(container.children.length));
    syncCountButtons(container.children.length);
    updateRemoveButtons();
    container.children[container.children.length - 1].querySelector('.name-input').focus();
  }

  function removePlayerRow(wrapper) {
    const container = $('#name-inputs');
    if (container.children.length <= MIN_PLAYERS) return;
    container.removeChild(wrapper);
    $$('.name-input-wrapper').forEach((row, i) => {
      row.querySelector('.player-number').textContent = i + 1;
      const input = row.querySelector('.name-input');
      input.dataset.index = String(i);
      input.placeholder = `Player ${i + 1}`;
    });
    syncCountButtons(container.children.length);
    updateRemoveButtons();
  }

  function syncCountButtons(count) {
    $$('.count-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.count) === count);
    });
  }

  function updateRemoveButtons() {
    const removable = $$('.name-input').length > MIN_PLAYERS;
    $$('.remove-player-btn').forEach(btn => {
      btn.disabled = !removable;
    });
  }

  function updateNameInputs() {
    const inputs = $$('.name-input');
    inputs.forEach((input, i) => {
      if (state.players[i]) {
        input.value = state.players[i].name;
      }
    });
  }

  function highlightCricketTargets() {
    $$('.num-btn').forEach(btn => {
      const num = parseInt(btn.dataset.num);
      btn.classList.toggle('cricket-target', CRICKET_NUMBERS.includes(num));
    });
  }

  // ===========================
  // GAME FLOW
  // ===========================
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

  // ===========================
  // INPUT HANDLING
  // ===========================
  function selectNumber(num) {
    input.number = num;
    input.special = null;
    input.selected = true;

    // Save the current multiplier value, update UI, then score before resetting
    const currentMult = input.multiplier;

    // Update UI
    $$('.num-btn').forEach(btn => {
      btn.classList.toggle('selected', parseInt(btn.dataset.num) === num);
    });
    $$('.mult-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.mult) === 1);
    });
    $$('.special-btn').forEach(btn => btn.classList.remove('selected'));

    // Reset multiplier for next throw
    input.multiplier = 1;

    updateUndoButton();

    // Instant scoring — use saved multiplier before reset
    submitScore(currentMult);
  }

  function selectMultiplier(mult) {
    input.multiplier = mult;
    input.special = null;

    if (input.selected && input.number !== null) {
      // Number is currently selected — score immediately with new multiplier
      $$('.num-btn').forEach(btn => {
        btn.classList.toggle('selected', input.selected && parseInt(btn.dataset.num) === input.number);
      });
      $$('.mult-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.mult) === mult);
      });
      $$('.special-btn').forEach(btn => btn.classList.remove('selected'));

      updateUndoButton();

      // Instant scoring
      submitScore();
    } else {
      // No number currently selected — just set multiplier for next number press
      $$('.num-btn').forEach(btn => btn.classList.remove('selected'));
      $$('.mult-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.mult) === mult);
      });
      $$('.special-btn').forEach(btn => btn.classList.remove('selected'));

      updateUndoButton();
      // No instant score — wait for number
    }
  }

  function selectSpecial(type) {
    input.number = null;
    input.multiplier = 1;
    input.special = type;
    input.selected = false;

    $$('.num-btn').forEach(btn => btn.classList.remove('selected'));
    $$('.mult-btn').forEach(btn => btn.classList.remove('active'));
    $$('.special-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.special === type);
    });

    updateUndoButton();

    // Instant scoring
    submitScore();
  }

  function clearInput() {
    input.number = null;
    input.multiplier = 1;
    input.special = null;
    input.selected = false;

    $$('.num-btn').forEach(btn => btn.classList.remove('selected'));
    $$('.mult-btn').forEach((btn, i) => {
      btn.classList.toggle('active', i === 0);
    });
    $$('.special-btn').forEach(btn => btn.classList.remove('selected'));

    updateUndoButton();
  }

  function updateUndoButton() {
    const undoBtn = $('#undo-btn');
    // Enable undo if there's an incomplete turn or completed history to undo
    undoBtn.disabled = !state._currentPlayerTurn && state.history.length === 0 || state.gameOver;
  }

  // ===========================
  // UNDO
  // ===========================
  function undoLast() {
    if (state.gameOver) return;

    // Case 1: Incomplete turn — pop the last dart from the current in-progress turn
    if (state._currentPlayerTurn && state._currentPlayerTurn.throws.length > 0) {
      const turn = state._currentPlayerTurn;
      const player = state.players[state.currentPlayerIndex];

      const dartIndex = turn.throws.length - 1;
      const scored = turn._scoring[dartIndex];
      const lastLabel = turn.throws.pop();
      const lastValue = turn.values.pop();

      revertPlayerStats(player, lastValue, lastLabel, scored);
      state.throwCount = Math.max(0, state.throwCount - 1);

      // Clean up empty turn to prevent broken state on repeated undo
      if (turn.throws.length === 0) {
        delete state._currentPlayerTurn;
        // Shared array — the history entry behind it is also empty now.
        // Remove it so undo doesn't need an extra click to clean up leftovers.
        const lastHistory = state.history[state.history.length - 1];
        if (lastHistory && lastHistory.throws.length === 0) {
          state.history.pop();
        }
      }

      clearInput();
      saveGameState();
      renderGame();
      return;
    }

    // Case 2: Completed turn — pop the last dart from the last history entry
    if (state.history.length === 0) return;

    const lastEntry = state.history[state.history.length - 1];
    if (lastEntry.throws.length === 0) {
      // Entry has no more darts — just remove it
      state.history.pop();
      clearInput();
      saveGameState();
      renderGame();
      return;
    }

    const dartIndex = lastEntry.throws.length - 1;
    const scored = lastEntry._scoring?.[dartIndex] || false;
    const lastLabel = lastEntry.throws.pop();
    const lastValue = lastEntry.values.pop();
    const player = state.players.find(p => p.id === lastEntry.playerId);
    if (!player) return;

    revertPlayerStats(player, lastValue, lastLabel, scored);

    // If the entry is now empty, remove it entirely
    if (lastEntry.throws.length === 0) {
      state.history.pop();
      // Entry consumed — no turn to restore, game moves forward
    } else {
      // Entry still has remaining darts — share the arrays directly so
      // Case 1 pops on the same underlying arrays (slice() caused a bug
      // where Case 1 modifications didn't affect history, allowing extra undos)
      state._currentPlayerTurn = {
        round: lastEntry.round,
        playerId: lastEntry.playerId,
        name: lastEntry.name,
        throws: lastEntry.throws,  // Direct reference, no copy
        values: lastEntry.values,  // Direct reference, no copy
        _scoring: lastEntry._scoring,  // Direct reference, no copy
        total: lastEntry.values.reduce((a, b) => a + b, 0)
      };

      // Put the undone player back in the active slot via their array index
      const undonePlayerIndex = state.players.findIndex(
        p => p.id === lastEntry.playerId
      );
      state.currentPlayerIndex = undonePlayerIndex;
      state.throwCount = state._currentPlayerTurn.throws.length;
    }

    clearInput();
    saveGameState();
    renderGame();
  }

  function revertPlayerStats(player, value, throwLabel, scored) {
    if (throwLabel && throwLabel.includes('BUST')) {
      // Bust — everything was already reverted in processX01Score
      return;
    }

    if (state.mode === 'x01') {
      player.score += value;
      player.runs -= value;
      player.turns--;
      if (player.score > 0) player.finished = false;
    } else if (state.mode === 'cricket') {
      const marksToUndo = getMarksForThrow(throwLabel);
      // Reverse marks
      for (const [num, count] of Object.entries(marksToUndo)) {
        const key = typeof num === 'number' ? num : num;
        player.marks[key] = Math.max(0, (player.marks[key] || 0) - count);
      }

      // Only subtract runs if this dart was scoring
      if (scored) player.runs -= value;
      player.turns--;

      // Unfinish if not all marks are closed
      const stillClosed = CRICKET_NUMBERS.every(n => (player.marks[n] || 0) >= CRICKET_TARGET_MARKS)
        && (player.marks['bull'] || 0) >= CRICKET_TARGET_MARKS;
      if (!stillClosed) player.finished = false;
    }
  }

  function getMarksForThrow(label) {
    const marks = {};
    if (!label) return marks;

    const trimmed = label.replace(' (BUST)', '');
    if (trimmed === 'Bull') {
      marks['bull'] = 1;
    } else if (trimmed === 'BE') {
      marks['bull'] = 2;
    } else if (trimmed.startsWith('D')) {
      const num = parseInt(trimmed.substring(1));
      if (!isNaN(num) && CRICKET_NUMBERS.includes(num)) marks[num] = 2;
    } else if (trimmed.startsWith('T')) {
      const num = parseInt(trimmed.substring(1));
      if (!isNaN(num) && CRICKET_NUMBERS.includes(num)) marks[num] = 3;
    } else {
      const num = parseInt(trimmed);
      if (!isNaN(num) && CRICKET_NUMBERS.includes(num)) marks[num] = 1;
    }
    return marks;
  }

  // ===========================
  // SCORING
  // ===========================
  function submitScore(forcedMult) {
    if (state.gameOver) return;

    const player = state.players[state.currentPlayerIndex];
    let throwValue = 0;
    let throwLabel = '';
    let marksEarned = {};

    if (input.special === '0') {
      throwValue = 0;
      throwLabel = 'MISS';
    } else if (input.special === 'bull') {
      throwValue = 25;
      throwLabel = 'Bull';
      if (state.mode === 'cricket') marksEarned['bull'] = 1;
    } else if (input.special === 'bulleye') {
      throwValue = 50;
      throwLabel = 'BE';
      if (state.mode === 'cricket') marksEarned['bull'] = 2;
    } else if (input.selected && input.number !== null) {
      const mult = forcedMult !== undefined ? forcedMult : input.multiplier;
      throwValue = input.number * mult;
      if (mult === 1) {
        throwLabel = `${input.number}`;
      } else if (mult === 2) {
        throwLabel = `D${input.number}`;
      } else {
        throwLabel = `T${input.number}`;
      }

      if (state.mode === 'cricket' && CRICKET_NUMBERS.includes(input.number)) {
        marksEarned[input.number] = mult;
      }
    } else {
      // No valid input — bail
      return;
    }

    // Process score based on mode
    let bust = false;
    let cricketResult = state.mode === 'cricket' ? null : undefined;
    if (state.mode === 'x01') {
      bust = processX01Score(player, throwValue, throwLabel);
    } else if (state.mode === 'cricket') {
      cricketResult = processCricketScore(player, throwValue, throwLabel, marksEarned);
    }

    // Track current turn throws
    if (!state._currentPlayerTurn) {
      state._currentPlayerTurn = {
        round: state.round,
        playerId: player.id,
        name: player.name,
        throws: [],
        values: [],
        _scoring: []
      };
    }

    if (bust) {
      state._currentPlayerTurn.throws.push(`${throwLabel} (BUST)`);
      state._currentPlayerTurn.values.push(throwValue);
      if (state.mode === 'cricket') state._currentPlayerTurn._scoring.push(false);
    } else {
      state._currentPlayerTurn.throws.push(throwLabel);
      state._currentPlayerTurn.values.push(throwValue);
    }

    // Track if this dart scored points (closed a number in cricket)
    if (state.mode === 'cricket' && cricketResult && cricketResult.scored) {
      state._currentPlayerTurn._scoring[state._currentPlayerTurn.values.length - 1] = true;
    }

    state.throwCount++;

    // If player finished mid-turn, end the turn immediately
    if (cricketResult?.finished || (state.mode === 'x01' && player.finished)) {
      state.throwCount = SCORES_PER_TURN;
    }

    // X01 bust ends the turn — remaining darts count as misses.
    // Auto-misses count as darts (player.turns) so undoing them stays balanced.
    if (bust) {
      while (state.throwCount < SCORES_PER_TURN) {
        state._currentPlayerTurn.throws.push('MISS');
        state._currentPlayerTurn.values.push(0);
        player.turns++;
        state.throwCount++;
      }
    }

    // Check if turn is complete (3 scores)
    if (state.throwCount >= SCORES_PER_TURN) {
      // Complete the turn — add to history
      let turnTotal;
      if (state.mode === 'x01') {
        // For X01, total excludes busted values
        turnTotal = state._currentPlayerTurn.values.reduce(
          (sum, val, i) => sum + (state._currentPlayerTurn.throws[i] && state._currentPlayerTurn.throws[i].includes('BUST') ? 0 : val), 0
        );
      } else {
        // Cricket: only count points from darts that closed a number
        turnTotal = state._currentPlayerTurn.values.reduce((sum, val, i) => {
          if (state._currentPlayerTurn._scoring && state._currentPlayerTurn._scoring[i]) return sum + val;
          return sum;
        }, 0);
      }
      state._currentPlayerTurn.total = turnTotal;
      state.history.push(state._currentPlayerTurn);

      state._currentPlayerTurn = null;

      // Move to next unfixed player
      let nextIdx = (state.currentPlayerIndex + 1) % state.players.length;
      let safety = 0;
      while (state.players[nextIdx].finished && safety < state.players.length) {
        nextIdx = (nextIdx + 1) % state.players.length;
        safety++;
      }
      state.currentPlayerIndex = nextIdx;

      // Check game over: all but one finished
      const finishedCount = state.players.filter(p => p.finished).length;
      if (finishedCount >= state.players.length - 1 && finishedCount > 0) {
        endGame();
        return;
      }

      // Reset for next player's turn
      state.throwCount = 0;
      state.round++;
    }

    // Clear input for next throw
    clearInput();

    // Save state and render
    saveGameState();
    renderGame();
  }

  function processX01Score(player, value, label) {
    const scoreBeforeTurn = player.score;
    player.score -= value;
    player.runs += value;
    player.turns++;

    // Check for bust
    if (player.score < 0) {
      player.score = scoreBeforeTurn;  // Revert score
      player.runs -= value;             // Revert runs
      player.turns--;                   // Revert turn
      return true;  // Bust
    }

    // Check if player finished (score === 0)
    if (player.score === 0) {
      player.finished = true;
    }

    return false;
  }

  function processCricketScore(player, value, label, marksEarned) {
    player.turns++;

    // Apply marks
    let scored = false;
    for (const [num, count] of Object.entries(marksEarned)) {
      const key = typeof num === 'number' ? num : num;
      const marksBefore = player.marks[key] || 0;
      player.marks[key] = Math.min(marksBefore + count, CRICKET_TARGET_MARKS);
      // Score when hitting an already-closed target (4th hit onward) AND not all players have closed it
      if (marksBefore >= CRICKET_TARGET_MARKS) {
        const allPlayersClosed = state.players.every(p => (p.marks[key] || 0) >= CRICKET_TARGET_MARKS);
        if (!allPlayersClosed) {
          scored = true;
        }
      }
    }

    if (scored) player.runs += value;

    const allMarked = CRICKET_NUMBERS.every(n => player.marks[n] >= CRICKET_TARGET_MARKS)
      && player.marks['bull'] >= CRICKET_TARGET_MARKS;

    if (allMarked && !player.finished) {
      player.finished = true;
      return { finished: true, scored };
    }
    return { finished: false, scored };
  }

  // ===========================
  // RENDERING
  // ===========================
  function renderGame() {
    const player = state.players[state.currentPlayerIndex];

    // Clear cricket marks DOM before populating (prevents stale checkmarks from prev games)
    const cricketSection = $('#cricket-marks-section');
    if (state.mode === 'cricket') {
      cricketSection.style.display = 'flex !important';
      CRICKET_NUMBERS.concat(['bull']).forEach(n => {
        const el = $(`#marks-${n}`);
        if (el) {
          const numEl = el.querySelector('.mark-num');
          if (numEl) {
            numEl.textContent = n === 'bull' ? 'B' : String(n);
            numEl.classList.remove('closed');
          }
        }
      });
    } else {
      cricketSection.style.display = 'none';
    }

    const activeCard = $('#active-player-card');

    // Header info
    $('#game-mode-label').textContent = state.mode === 'x01' ? 'X01' : 'Cricket';
    $('#round-label').textContent = `Round ${state.round}`;

    const finishedCount = state.players.filter(p => p.finished).length;
    const remaining = state.players.length - finishedCount;
    $('#finish-count').textContent = remaining > 1 ? `${remaining} left` : '';

    // Active player
    $('#active-player-name').textContent = player.name;

    if (state.mode === 'x01') {
      $('#active-player-score').textContent = player.score;
      $('#active-score-label').textContent = 'Remaining';
    } else {
      // Cricket: use player's total points (only from cricket targets)
      $('#active-player-score').textContent = player.runs;
      $('#active-score-label').textContent = 'Points';
    }

    $('#active-runs').textContent = state.mode === 'cricket' ? `${player.runs} points` : `${player.runs} runs`;

    // Throws display — use in-progress turn throws if available
    let throwsToShow = [];
    if (state._currentPlayerTurn) {
      throwsToShow = state._currentPlayerTurn.throws;
    }
    for (let i = 0; i < 3; i++) {
      const slot = $(`#throw-${i}`);
      if (i < throwsToShow.length) {
        slot.textContent = throwsToShow[i];
        slot.classList.add('filled');
      } else {
        slot.innerHTML = '<span class="throw-empty">-</span>';
        slot.classList.remove('filled');
      }
    }

    // Cricket marks - already cleared above, now populate from player data
    if (state.mode === 'cricket') {
      CRICKET_NUMBERS.forEach(n => {
        updateMarkDisplay(`marks-${n}`, player.marks[n] || 0, false, n);
      });
      updateMarkDisplay('marks-bull', player.marks['bull'] || 0, true, 'bull');
    }

    // Queue
    renderQueue();

    // History
    renderHistory();
  }

  function updateMarkDisplay(elementId, marks, isBull, number) {
    const el = $(`#${elementId}`);
    if (!el) return;
    const dotsEl = el.querySelector('.mark-dots');
    const numEl = el.querySelector('.mark-num');
    if (!dotsEl || !numEl) return;

    dotsEl.innerHTML = '';
    const closed = marks >= CRICKET_TARGET_MARKS;

    for (let i = 0; i < CRICKET_TARGET_MARKS; i++) {
      const dot = document.createElement('span');
      dot.className = 'mark-dot';
      if (i < marks) {
        dot.classList.add('filled');
      }
      dotsEl.appendChild(dot);
    }

    if (closed) {
      // Green dots when all 3 filled
      dotsEl.querySelectorAll('.mark-dot.filled').forEach(d => d.classList.add('all-filled'));
      numEl.classList.add('closed');
      // Blue number when all players have 3 marks on this number
      const allPlayersClosed = state.players.every(p => (p.marks[number] || 0) >= CRICKET_TARGET_MARKS);
      if (allPlayersClosed) {
        dotsEl.querySelectorAll('.all-filled').forEach(d => d.classList.add('closed-all'));
        numEl.classList.add('closed-all');
      } else {
        numEl.classList.remove('closed-all');
      }
      numEl.textContent = isBull ? 'B' : `${numEl.textContent}`;
    } else {
      numEl.classList.remove('closed', 'closed-all');
      numEl.textContent = isBull ? 'B' : elementId.replace('marks-', '');
      dotsEl.querySelectorAll('.all-filled').forEach(d => d.classList.remove('all-filled'));
    }
  }

  function renderQueue() {
    const container = $('#queue-list');
    container.innerHTML = '';

    // Get players who are not the current player, ordered by who's next
    const activeIdx = state.currentPlayerIndex;
    const queuePlayers = [];

    for (let i = 1; i < state.players.length; i++) {
      const idx = (activeIdx + i) % state.players.length;
      const p = state.players[idx];
      queuePlayers.push({ ...p, nextInQueue: i === 1 });
    }

    queuePlayers.forEach((p, i) => {
      const el = document.createElement('div');
      el.className = 'queue-player';
      el.style.opacity = p.finished ? '0.5' : '1';

      let scoreText;
      if (p.finished) {
        scoreText = '✓ DONE';
        el.classList.add('finished');
      } else if (state.mode === 'x01') {
        scoreText = p.score;
      } else {
        scoreText = `${p.runs} points`;
      }

      let marksPreview = '';
      if (state.mode === 'cricket' && !p.finished) {
        marksPreview = '<div class="queue-marks-preview">';
        CRICKET_NUMBERS.concat(['bull']).forEach(n => {
          const m = p.marks[n] || 0;
          marksPreview += `<span class="queue-mark ${m >= CRICKET_TARGET_MARKS ? 'closed' : (m > 0 ? 'filled' : '')}"></span>`;
        });
        marksPreview += '</div>';
      }

      el.innerHTML = `
        <div class="queue-player-info">
          <span class="queue-position">${i + 1}</span>
          <span class="queue-player-name">${p.name}</span>
          ${marksPreview}
        </div>
        <span class="queue-player-score ${p.finished ? 'finished' : ''}">${scoreText}</span>
      `;

      container.appendChild(el);
    });
  }

  function renderHistory() {
    const container = $('#history-list');

    // Show last 20 history entries, newest first
    const entries = state.history.slice(-20).reverse();

    if (entries.length === 0) {
      container.innerHTML = '';
      return;
    }

    // If no entries yet, build all
    if (container.children.length === 0) {
      entries.forEach(entry => {
        const el = document.createElement('div');
        el.className = 'history-entry';
        el.innerHTML = `
          <span class="history-round">R${entry.round}</span>
          <span class="history-player">${entry.name}</span>
          <div class="history-throws">${entry.throws.map(t => `<span class="history-throw">${t}</span>`).join('')}</div>
          <span class="history-total">${entry.total > 0 ? entry.total : ''}</span>
        `;
        container.appendChild(el);
      });
    } else {
      const existingTotal = container.children.length;
      const newCount = entries.length;

      if (newCount > existingTotal) {
        // A new entry was added — it's the first in the reversed array
        const entry = entries[0];
        const el = document.createElement('div');
        el.className = 'history-entry';
        el.innerHTML = `
          <span class="history-round">R${entry.round}</span>
          <span class="history-player">${entry.name}</span>
          <div class="history-throws">${entry.throws.map(t => `<span class="history-throw">${t}</span>`).join('')}</div>
          <span class="history-total">${entry.total > 0 ? entry.total : ''}</span>
        `;
        // Insert at the top (newest first)
        container.prepend(el);
      } else if (newCount < existingTotal) {
        // Count decreased (undo removed entry) — rebuild without animation
        container.innerHTML = '';
        entries.forEach(entry => {
          const el = document.createElement('div');
          el.classList.add('history-entry', 'no-anim');
          el.innerHTML = `
            <span class="history-round">R${entry.round}</span>
            <span class="history-player">${entry.name}</span>
            <div class="history-throws">${entry.throws.map(t => `<span class="history-throw">${t}</span>`).join('')}</div>
            <span class="history-total">${entry.total > 0 ? entry.total : ''}</span>
          `;
          container.appendChild(el);
        });
      }
      // If count is the same, values changed (undo modified a turn) — update in place
      else {
        entries.forEach((entry, i) => {
          const el = container.children[i];
          el.querySelector('.history-total').textContent = entry.total > 0 ? entry.total : '';
          el.querySelector('.history-throws').innerHTML = entry.throws.map(t =>
            `<span class="history-throw">${t}</span>`
          ).join('');
        });
      }
    }

    // Auto-scroll to top (newest entry)
    container.scrollTop = 0;
  }

  // ===========================
  // STATS SCREEN
  // ===========================
  function renderStatsScreen() {
    const container = $('#stats-list');
    container.innerHTML = '';

    const entries = Object.entries(stats.players)
      .filter(([, e]) => e.modes)
      .map(([key, e]) => ({ key, ...e }))
      .sort((a, b) => totalGames(b) - totalGames(a) || a.name.localeCompare(b.name));

    if (entries.length === 0) {
      container.innerHTML = '<div class="stats-empty">No stats yet — finish a game to start tracking players.</div>';
    } else {
      entries.forEach(entry => {
        const el = document.createElement('div');
        el.className = 'stats-player';
        const cards = ['x01', 'cricket']
          .map(mode => renderModeCard(entry, mode))
          .filter(Boolean)
          .join('');
        el.innerHTML = `
          <div class="stats-player-header">
            <div class="stats-player-name">${entry.name}</div>
            <button class="remove-player-btn stats-reset-btn">✕</button>
          </div>
          ${cards}
        `;
        const resetBtn = el.querySelector('.stats-reset-btn');
        resetBtn.title = `Reset all stats for ${entry.name}`;
        resetBtn.setAttribute('aria-label', `Reset all stats for ${entry.name}`);
        resetBtn.addEventListener('click', () => resetPlayerStats(entry.key, entry.name));
        container.appendChild(el);
      });
    }

    renderRecentGames();
  }

  function resetPlayerStats(key, name) {
    if (!confirm(`Reset all stats for ${name}? This cannot be undone.`)) return;
    delete stats.players[key];
    saveStats();
    renderStatsScreen();
  }

  function renderRecentGames() {
    const el = $('#recent-games');
    if (!el) return;

    if (!stats.games || stats.games.length === 0) {
      el.classList.add('hidden');
      el.innerHTML = '';
      return;
    }

    el.classList.remove('hidden');
    const rows = stats.games.slice().reverse().map(g => {
      const date = new Date(g.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const modeLabel = g.mode === 'x01' ? `X01 ${g.x01Start}` : 'Cricket';
      const scores = g.results.map(r => `${r.name} ${r.score}`).join(' · ');
      return `
        <div class="recent-game">
          <div class="recent-game-top">
            <span class="recent-game-date">${date}</span>
            <span class="recent-game-mode">${modeLabel}</span>
            <span class="recent-game-winner">${g.winner} wins</span>
          </div>
          <div class="recent-game-scores">${scores}</div>
        </div>
      `;
    }).join('');
    el.innerHTML = '<h3 class="recent-games-title">Recent Games</h3>' + rows;
  }

  function totalGames(entry) {
    return (entry.modes.x01 ? entry.modes.x01.gamesPlayed : 0) + (entry.modes.cricket ? entry.modes.cricket.gamesPlayed : 0);
  }

  function renderModeCard(entry, mode) {
    const m = entry.modes[mode];
    if (!m || m.gamesPlayed === 0) return '';
    const isX01 = mode === 'x01';
    const cards = [
      { value: m.gamesPlayed, label: 'Games' },
      { value: m.wins, label: 'Wins' },
      { value: `${m.winRate}%`, label: 'Win Rate' },
      { value: m.avgPerTurn, label: 'Avg / Turn' },
      { value: m.avgPerGame, label: 'Avg / Game' },
      isX01
        ? { value: m.bestTurn, label: 'Best Turn' }
        : { value: m.bestTurn, label: 'Best Leg' },
      isX01
        ? { value: m.bestScore, label: 'Best Finish' }
        : { value: m.bullDarts, label: 'Bull Darts' },
      isX01
        ? { value: m.checkoutAttempts > 0 ? `${m.checkoutPct}%` : '—', label: 'Checkout %' }
        : { value: m.maxDarts, label: 'Max Darts' }
    ];
    return `
      <div class="stats-mode-card">
        <h3 class="stats-mode-title">${isX01 ? 'X01' : 'Cricket'}</h3>
        <div class="stats-grid stats-grid-4">
          ${cards.map(c => `<div class="stat-card"><div class="stat-value">${c.value}</div><div class="stat-label">${c.label}</div></div>`).join('')}
        </div>
      </div>`;
  }

  // ===========================
  // END GAME
  // ===========================
  function endGame() {
    state.gameOver = true;
    clearGameState();

    // Determine results order
    const results = [...state.players].sort((a, b) => {
      if (a.finished && !b.finished) return -1;
      if (!a.finished && b.finished) return 1;
      // If both finished or both not, sort by score (X01: lower is better, Cricket: higher is better)
      if (state.mode === 'x01') return a.score - b.score;
      return b.runs - a.runs;
    });

    // Mark winner
    results[0].isWinner = true;

    // Update stats
    results.forEach((p, i) => {
      updatePlayerStats(p, i === 0);
    });

    // Save to history
    saveGameToHistory({
      winner: results[0].name,
      results: results.map((p, i) => ({
        position: i + 1,
        name: p.name,
        score: state.mode === 'x01' ? p.score : p.runs,
        runs: p.runs,
        turns: p.turns,
        finished: p.finished
      }))
    });

    // Render results modal
    renderResultsModal(results);

    // Show modal
    $('#end-modal').classList.remove('hidden');
  }

  function renderResultsModal(results) {
    const container = $('#results-list');
    container.innerHTML = '';

    results.forEach((p, i) => {
      const el = document.createElement('div');
      el.className = 'result-entry';

      let details = '';
      if (state.mode === 'x01') {
        details = `<span>${p.finished ? 'Finished' : 'Remaining: ' + p.score}</span>
                   <span>${p.runs} runs | ${p.turns} turns</span>`;
      } else {
        details = `<span>${p.finished ? '✓ Closed' : 'In progress'}</span>
                   <span>${p.runs} points | ${p.turns} turns</span>`;
      }

      el.innerHTML = `
        <div class="result-rank">${i + 1}</div>
        <span class="result-name">${i === 0 ? '🏆 ' : ''}${p.name}</span>
        <div class="result-details">${details}</div>
      `;

      container.appendChild(el);
    });

    // Stats summary
    const totalTurns = results.reduce((sum, p) => sum + p.turns, 0);
    const totalRuns = results.reduce((sum, p) => sum + p.runs, 0);
    const avgRuns = totalTurns > 0 ? Math.round(totalRuns / totalTurns * 10) / 10 : 0;

    // Find best turn from history for each player
    const bestTurns = {};
    state.history.forEach(h => {
      if (!bestTurns[h.name] || h.total > bestTurns[h.name]) {
        bestTurns[h.name] = h.total;
      }
    });
    const overallBestTurn = Math.max(...Object.values(bestTurns), 0);

    $('#history-summary').innerHTML = `
      <div class="history-summary">
        <h3>Game Stats</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${results.length}</div>
            <div class="stat-label">Players</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${state.round}</div>
            <div class="stat-label">Rounds</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${avgRuns}</div>
            <div class="stat-label">${state.mode === 'cricket' ? 'Avg Points/Turn' : 'Avg Runs/Turn'}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${overallBestTurn}</div>
            <div class="stat-label">Best Turn</div>
          </div>
        </div>
      </div>
    `;
  }

  // ===========================
  // INIT
  // ===========================
  init();

})();
