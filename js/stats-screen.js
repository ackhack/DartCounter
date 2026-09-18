// ===========================
// DART COUNTER - Stats Screen
// ===========================
'use strict';

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
