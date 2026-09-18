// ===========================
// DART COUNTER - Local Storage
// ===========================
'use strict';

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
      if (t === 'Bull' || t === 'BE' || t === 'BullsEye') count++;
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
