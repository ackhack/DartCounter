// ===========================
// DART COUNTER - End Game
// ===========================
'use strict';

let autoRestartTimer = null; // pending countdown to the next auto-started game

function endGame() {
  state.gameOver = true;
  updateUndoButton();

  // Determine results order
  const results = [...state.players].sort((a, b) => {
    return b.currentGamePosition - a.currentGamePosition;
  });

  // Mark winner
  results[0].isWinner = true;

  // Update stats — skip anonymous "Player N" names and the computer so
  // placeholder games and CPU play don't create per-player stat entries.
  results.forEach((p, i) => {
    p.lastGamePosition = i;
    p.currentGamePosition = 0;
    if (!isDefaultPlayerName(p.name) && !p.isCpu) {
      updatePlayerStats(p, i === 0);
    }
  });

  // Save to history — skip entirely when no human used a real name.
  if (results.some(p => !isDefaultPlayerName(p.name) && !p.isCpu)) {
    saveGameToHistory({
      winner: results[0].name,
      results: results.map((p, i) => ({
        position: i + 1,
        name: p.name,
        score: isX01() ? p.score : p.runs,
        runs: p.runs,
        turns: p.turns,
        finished: p.finished
      }))
    });
  }

  // Render results modal
  renderResultsModal(results);

  // Auto-start the next game after a short pause (cancellable via the modal).
  startAutoRestart();
}

function renderResultsModal(results) {
  const container = $('#results-list');
  container.innerHTML = '';

  results.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'result-entry';

    let details = '';
    if (isX01()) {
      details = `<span>${p.finished ? 'Finished' : 'Remaining: ' + p.score}</span>
                 <span>${p.runs} points | ${p.turns} turns</span>`;
    } else if (isShanghai()) {
      details = `<span>${p.finished ? '🏆 Instant win' : 'Finished'}</span>
                 <span>${p.runs} points | ${p.turns} darts</span>`;
    } else {
      details = `<span>${p.finished ? '✓ Closed' : 'In progress'}</span>
                 <span>${p.runs} points | ${p.turns} turns</span>`;
    }

    el.innerHTML = `
      <div class="result-rank">${i + 1}</div>
      <span class="result-name"${p.color ? ` style="color:${p.color}"` : ''}>${i === 0 ? '🏆 ' : ''}${p.name}</span>
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

  // In Shanghai the "rounds" stat is how far the targets got (a full game
  // reaches 21; an instant win stops earlier).
  const roundsValue = isShanghai()
    ? Math.min(state.shanghaiIndex + 1, SHANGHAI_TARGETS.length)
    : state.round;

  $('#history-summary').innerHTML = `
    <div class="history-summary">
      <h3>Game Stats</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${results.length}</div>
          <div class="stat-label">Players</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${roundsValue}</div>
          <div class="stat-label">${isShanghai() ? 'Numbers' : 'Rounds'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${avgRuns}</div>
          <div class="stat-label">${isCricket() ? 'Avg Points/Turn' : 'Avg Points/Turn'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${overallBestTurn}</div>
          <div class="stat-label">Best Turn</div>
        </div>
      </div>
    </div>
  `;

  // Per-player hit boards, left of the results.
  renderEndBoards(results);

  // Show modal
  $('#end-modal').classList.remove('hidden');
}

// Render one dartboard per player (winner first) into #player-boards. Every
// dart with a recorded landing (CPU darts, DartIt bridge darts) gets a dot
// colored by the ideal throw it aimed at (recorded aim for CPU darts, else
// the throw-time checkout suggestion — see collectBoardDarts), and every
// ideal field gets a translucent zone disk in the same color, centered on
// the aim point and reaching the farthest dart that aimed at it (see
// boardZones). Manual input has no recorded landing and gets no dot (only
// the dart/miss count under the board). Misses are not plotted either.
function renderEndBoards(results) {
  const container = $('#player-boards');
  container.innerHTML = '';

  // Size the field for the actual player count so it always fills the left
  // side: fewer boards -> fewer rows/columns -> bigger boards. CSS
  // (--board-size in modal.css) derives the size from these.
  const cols = results.length === 4 ? 2 : Math.min(3, results.length);
  container.style.setProperty('--board-cols', String(cols));
  container.style.setProperty('--board-rows', String(Math.ceil(results.length / cols)));

  // A manual End can fire mid-turn — include the in-progress turn too.
  const turns = state._currentPlayerTurn
    ? state.history.concat([state._currentPlayerTurn])
    : state.history;

  results.forEach((p) => {
    const board = collectBoardDarts(turns, p.id);

    const block = document.createElement('div');
    block.className = 'player-board';

    const name = document.createElement('div');
    name.className = 'player-board-name';
    name.style.color = p.color;
    name.textContent = p.name;

    // Zone disks + dots + aim x's in one shared builder (js/polar.js).
    const face = createBoardFace(board.dots);

    const meta = document.createElement('div');
    meta.className = 'player-board-meta';
    meta.textContent = board.darts + ' darts · ' + board.misses + (board.misses === 1 ? ' miss' : ' misses');

    block.appendChild(name);
    block.appendChild(face);
    block.appendChild(meta);
    container.appendChild(block);
  });
}

// Count down AUTO_RESTART_DELAY seconds in the modal, then start the next
// game automatically. clearAutoRestart() stops it (Cancel, or any transition
// away from the modal).
function startAutoRestart() {
  clearAutoRestart();
  const el = $('#auto-restart-countdown');
  let remaining = AUTO_RESTART_DELAY;
  if (el) el.textContent = `Next game in ${remaining}s`;
  autoRestartTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearAutoRestart();
      replayGame();
    } else if (el) {
      el.textContent = `Next game in ${remaining}s`;
    }
  }, 1000);
}

// Stop a pending auto-restart and clear the countdown text. Safe to call when
// nothing is pending.
function clearAutoRestart() {
  if (autoRestartTimer) {
    clearInterval(autoRestartTimer);
    autoRestartTimer = null;
  }
  const el = $('#auto-restart-countdown');
  if (el) el.textContent = '';
}
