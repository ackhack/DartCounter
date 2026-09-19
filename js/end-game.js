// ===========================
// DART COUNTER - End Game
// ===========================
'use strict';

function endGame() {
  state.gameOver = true;
  updateUndoButton();
  clearGameState();

  // Determine results order
  const results = [...state.players].sort((a, b) => {
    return b.lastGamePosition - a.lastGamePosition;
  });

  // Mark winner
  results[0].isWinner = true;

  // Update stats
  results.forEach((p, i) => {
    p.lastGamePosition = i;
    updatePlayerStats(p, i === 0);
  });

  // Save to history
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

  // Render results modal
  renderResultsModal(results);
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
          <div class="stat-label">${isCricket() ? 'Avg Points/Turn' : 'Avg Points/Turn'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${overallBestTurn}</div>
          <div class="stat-label">Best Turn</div>
        </div>
      </div>
    </div>
  `;

  // Show modal
  $('#end-modal').classList.remove('hidden');
}
