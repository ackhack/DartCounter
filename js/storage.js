// ===========================
// DART COUNTER - Local Storage
// ===========================
'use strict';

// dartcounter_stats holds only full game records. Per-player stats are
// not persisted at all — derivePlayerStats() computes them from the game
// history at render time (js/stats-screen.js). Names and colors live in
// their own keys (dartcounter_player_names / dartcounter_player_colors).
//
// Saved game shape:
//   { date, mode, x01Start, winner,
//     results: [{ position, name, score, runs, turns, finished }],  // recent-games rows
//     players: [{ name, isCpu, finished, runs, turns, score, marks? }],
//     turns:   [{ playerId, throws, total?, start, sh?,
//                 hits: [{ r, angle, ideal }] }] }
// players[i] is the final snapshot of that player and its index is
// turn.playerId. Turns are lean: the throw labels already encode
// value/multiplier, so values/_scoring/round are not saved; `total` is
// omitted while a turn is still in progress (manual mid-turn end), `sh`
// (Shanghai target index) is omitted in non-Shanghai games, and `hits`
// holds only recorded landings (CPU darts, DartIt bridge darts).
// Pre-full-record games (no turns array) are kept — they still show in
// the recent-games list, but the derivation skips them.

function loadStats() {
  try {
    const data = localStorage.getItem(STORAGE_KEY_STATS);
    const parsed = data ? JSON.parse(data) : { games: [] };
    if (!Array.isArray(parsed.games)) parsed.games = [];
    // Blobs from the per-player-aggregate era carry a `players` map.
    // Those aggregates can't be rebuilt into full games, so drop them on
    // load (the old summary games are kept).
    delete parsed.players;
    return parsed;
  } catch {
    return { games: [] };
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

function loadPlayerColors() {
  try {
    const data = localStorage.getItem(STORAGE_KEY_COLORS);
    const parsed = data ? JSON.parse(data) : {};
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function savePlayerColors(colors) {
  try {
    localStorage.setItem(STORAGE_KEY_COLORS, JSON.stringify(colors));
  } catch (e) {
    console.warn('Failed to save player colors:', e);
  }
}

function saveStats() {
  try {
    localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(stats));
  } catch (e) {
    console.warn('Failed to save stats:', e);
  }
}

function computeModeAverages(m) {
  m.avgPerTurn = m.totalTurns > 0 ? Math.round(m.totalRuns / m.totalTurns * 10) / 10 : 0;
  m.avgPerGame = m.gamesPlayed > 0 ? Math.round(m.totalRuns / m.gamesPlayed * 10) / 10 : 0;
  m.winRate = m.gamesPlayed > 0 ? Math.round(m.wins / m.gamesPlayed * 100) : 0;
  m.checkoutPct = m.checkoutAttempts > 0 ? Math.round(m.checkouts / m.checkoutAttempts * 100) : 0;
  m.avgCountingHits = m.totalTurns > 0 ? Math.round(m.countingHits / m.totalTurns * 10) / 10 : 0;
}

// Fresh per-mode bucket for derivePlayerStats — the exact field set the
// stats screen renders (js/stats-screen.js).
function emptyModeBucket() {
  return {
    gamesPlayed: 0,
    wins: 0,
    totalRuns: 0,
    totalTurns: 0,
    totalDarts: 0,
    totalMisses: 0,
    maxDarts: 0,
    bestTurn: 0,
    bestScore: 0,  // X01: lowest remaining score
    checkoutAttempts: 0,
    checkouts: 0,
    bullDarts: 0,
    bestGame: 0,     // cricket/shanghai: highest single-game score (runs)
    instantWins: 0,  // shanghai: games won with the S+D+T combo
    eighteens: 0,    // x01: turns totalling 180
    t20s: 0,         // x01: triple-20 darts
    countingHits: 0, // cricket/shanghai: darts on the scoring target, weighted by multiplier
    avgPerTurn: 0,
    avgPerGame: 0,
    winRate: 0,
    checkoutPct: 0,
    avgCountingHits: 0,
    hits: []
  };
}

// X01 checkout attempts/made for one saved game — the same walk as the
// old per-game computeX01CheckoutStats: a turn started from
// score <= MAX_X01_TURN was a checkout opportunity; the finishing turn
// is the player's last one.
function x01CheckoutStats(entries, finalScore, finished) {
  if (entries.length === 0) return { attempts: 0, made: 0 };
  let afterScore = finalScore;
  let attempts = 0;
  let made = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (typeof entries[i].total !== 'number') continue; // in-progress turn
    const startScore = afterScore + entries[i].total;
    if (startScore <= MAX_X01_TURN) {
      attempts++;
      if (i === entries.length - 1 && finished) made++;
    }
    afterScore = startScore;
  }
  return { attempts, made };
}

// "Counting hits" for one turn (cricket/shanghai): every dart on the
// scoring target, weighted by multiplier (T = 3, D = 2, single = 1;
// Bull = 1, BE = 2 — the engine scores a bulls-eye as 25 × 2 in both
// modes, so it banks double in the bull round). Cricket targets:
// 15–20 + bull. Shanghai: the turn's current target only.
function countingHitsInTurn(turn, mode) {
  let hits = 0;
  const target = mode === 'shanghai' ? SHANGHAI_TARGETS[turn.sh] : null;
  for (const label of turn.throws) {
    const t = String(label).replace(' (BUST)', '');
    let weight = 0;
    let number = null;
    if (t === 'Bull') {
      weight = 1;
    } else if (t === 'BE') {
      weight = 2;
    } else {
      const m = t.match(/^([TD]?)(\d+)$/);
      if (m) {
        number = parseInt(m[2], 10);
        weight = m[1] === 'T' ? 3 : m[1] === 'D' ? 2 : 1;
      }
    }
    if (weight === 0) continue;
    const onTarget = mode === 'cricket'
      ? (number !== null && CRICKET_NUMBERS.includes(number)) || t === 'Bull' || t === 'BE'
      : (number !== null && number === target) || (target === BULL_NUMBER && (t === 'Bull' || t === 'BE'));
    if (onTarget) hits += weight;
  }
  return hits;
}

// Everything the stats screen shows per player, derived from the full
// game records — nothing per-player is persisted. Returns
// { [name.toLowerCase()]: { name, modes: { x01, cricket, shanghai } } }.
// CPU players and anonymous "Player N" names get no entry (their turns
// are still in the records — the record is the full game).
// Pre-full-record summary games (no turns array) are skipped.
function derivePlayerStats(games) {
  const byKey = {};

  for (const g of games || []) {
    if (!g || !Array.isArray(g.players) || !Array.isArray(g.turns)) continue;

    for (let idx = 0; idx < g.players.length; idx++) {
      const p = g.players[idx];
      if (!p || p.isCpu || isDefaultPlayerName(p.name)) continue;
      const key = p.name.toLowerCase();
      if (!byKey[key]) {
        byKey[key] = {
          name: p.name,
          modes: {
            x01: emptyModeBucket(),
            cricket: emptyModeBucket(),
            shanghai: emptyModeBucket()
          }
        };
      }
      const m = byKey[key].modes[g.mode];
      if (!m) continue; // unknown mode in an old record — skip, don't crash
      accumulateGameStats(m, g, idx, p);
    }
  }
  return byKey;
}

function accumulateGameStats(m, game, playerIdx, player) {
  m.gamesPlayed++;
  if (game.winner === player.name) m.wins++;
  m.totalRuns += player.runs || 0;
  m.totalDarts += player.turns || 0;
  if (player.turns > m.maxDarts) m.maxDarts = player.turns;
  if (game.mode === 'x01' && player.score >= 0 && (m.bestScore === 0 || player.score < m.bestScore)) {
    m.bestScore = player.score;
  }
  // Best Leg = highest single-game score. In Shanghai `finished` is only
  // ever set by the S+D+T instant win, so finished && winner is the
  // instant-win count.
  if (game.mode === 'cricket' || game.mode === 'shanghai') {
    if ((player.runs || 0) > m.bestGame) m.bestGame = player.runs;
  }
  if (game.mode === 'shanghai' && player.finished && game.winner === player.name) {
    m.instantWins++;
  }

  const entries = game.turns.filter(t => t && t.playerId === playerIdx);
  for (const t of entries) {
    // A turn without a total is the in-progress one (manual mid-turn
    // end): its darts still count in the hits board, but not in the
    // per-turn stats.
    if (typeof t.total !== 'number') continue;
    m.totalTurns++;
    if (t.total > m.bestTurn) m.bestTurn = t.total;
    for (const label of t.throws) {
      if (label === 'Bull' || label === 'BE' || label === 'BullsEye') m.bullDarts++;
    }
    if (game.mode === 'x01') {
      if (t.total === MAX_X01_TURN) m.eighteens++;
      for (const label of t.throws) {
        if (String(label).replace(' (BUST)', '') === 'T20') m.t20s++;
      }
    } else {
      m.countingHits += countingHitsInTurn(t, game.mode);
    }
  }
  if (game.mode === 'x01') {
    const co = x01CheckoutStats(entries, player.score, player.finished);
    m.checkoutAttempts += co.attempts;
    m.checkouts += co.made;
  }

  // Recorded landings — saved turns match collectPlayerHits' expected
  // shape ({ playerId, throws, hits: [{ r, angle, ideal }] }), so the
  // end-screen collector is reused as-is (misses r > 1 kept, 'MISS'
  // fillers excluded, manual 'Miss' counted).
  const board = collectPlayerHits(game.turns, playerIdx);
  if (board.hits.length > 0) m.hits.push(...board.hits);
  m.totalMisses += board.misses;

  computeModeAverages(m);
}

// Persist the full game record — the source everything per-player is
// derived from. Written once at game end (so undo can't skew it); no cap.
function saveGameToHistory(result) {
  // A manual End can fire mid-turn — include the in-progress turn too
  // (same pattern as renderEndBoards), so its darts/hits are in the
  // record.
  const turns = state._currentPlayerTurn
    ? state.history.concat([state._currentPlayerTurn])
    : state.history;

  stats.games.push({
    date: Date.now(),
    mode: state.mode,
    x01Start: isX01() ? state.x01Start : null,
    winner: result.winner,
    results: result.results,
    players: state.players.map(p => {
      const snap = {
        name: p.name,
        isCpu: !!p.isCpu,
        finished: !!p.finished,
        runs: p.runs || 0,
        turns: p.turns || 0,
        score: typeof p.score === 'number' ? p.score : 0
      };
      // Cricket: the final marks are what numbers-closed stats derive
      // from later.
      if (isCricket() && p.marks && Object.keys(p.marks).length > 0) {
        snap.marks = p.marks;
      }
      return snap;
    }),
    turns: turns.map(t => {
      const lean = {
        playerId: t.playerId,
        throws: t.throws,
        start: t.startingScore
      };
      if (typeof t.total === 'number') lean.total = t.total;
      // Turn objects always carry shanghaiIndex (0 in other modes) — only
      // Shanghai games store it.
      if (isShanghai()) lean.sh = t.shanghaiIndex;
      if (t.hits && t.hits.length > 0) {
        lean.hits = t.hits.map(h => ({ r: h.r, angle: h.angle, ideal: h.ideal || DEFAULT_PLAYER_AIM }));
      }
      return lean;
    })
  });
  saveStats();
}
