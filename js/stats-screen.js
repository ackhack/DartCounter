// ===========================
// DART COUNTER - Stats Screen
// ===========================
'use strict';

// One expandable entry per player (top to bottom, most games first) plus
// the recent-games list as the bottom-most entry. Tapping an entry's header
// toggles its body; several entries can be open at once.
function renderStatsScreen() {
  const container = $('#stats-list');
  container.innerHTML = '';

  const entries = Object.entries(stats.players)
    .filter(([, e]) => e.modes)
    .map(([key, e]) => ({ key, ...e }))
    .sort((a, b) => totalGames(b) - totalGames(a) || a.name.localeCompare(b.name));

  const games = stats.games || [];
  if (entries.length === 0 && games.length === 0) {
    container.innerHTML = '<div class="stats-empty">No stats yet — finish a game to start tracking players.</div>';
    return;
  }

  entries.forEach(entry => container.appendChild(buildPlayerEntry(entry)));
  container.appendChild(buildGamesEntry());
}

function resetPlayerStats(key, name) {
  if (!confirm(`Reset all stats for ${name}? This cannot be undone.`)) return;
  delete stats.players[key];
  saveStats();
  renderStatsScreen();
}

function buildPlayerEntry(entry) {
  const el = document.createElement('div');
  el.className = 'stats-entry';

  const header = document.createElement('div');
  header.className = 'stats-entry-header';
  const color = playerColors[entry.key];
  header.innerHTML = `
    <span class="stats-chevron" aria-hidden="true">▶</span>
    <span class="stats-entry-name"${color ? ` style="color:${color}"` : ''}>${entry.name}</span>
    <span class="stats-entry-summary">${totalGames(entry)} ${totalGames(entry) === 1 ? 'game' : 'games'}</span>
    <button class="remove-player-btn stats-reset-btn">✕</button>
  `;
  const resetBtn = header.querySelector('.stats-reset-btn');
  resetBtn.title = `Reset all stats for ${entry.name}`;
  resetBtn.setAttribute('aria-label', `Reset all stats for ${entry.name}`);
  header.addEventListener('click', () => el.classList.toggle('open'));
  resetBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    resetPlayerStats(entry.key, entry.name);
  });

  const body = document.createElement('div');
  body.className = 'stats-entry-body';
  ['x01', 'cricket', 'shanghai'].forEach((mode) => {
    const section = renderModeSection(entry, mode);
    if (section) body.appendChild(section);
  });

  el.appendChild(header);
  el.appendChild(body);
  return el;
}

// One mode section: the stat cards, then the hit board in the end-screen
// style (createBoardFace, js/polar.js) — dots + zone disks for every
// recorded landing of this player in this mode (CPU darts, DartIt bridge
// darts). Manual input recorded no landing and plots nothing; with no
// dots there is no face, only the dart/miss line.
function renderModeSection(entry, mode) {
  const m = entry.modes[mode];
  if (!m || m.gamesPlayed === 0) return null;
  const isX01 = mode === 'x01';
  const modeTitles = { x01: 'X01', cricket: 'Cricket', shanghai: 'Shanghai' };
  const cards = [
    { value: m.gamesPlayed, label: 'Games' },
    { value: m.wins, label: 'Wins' },
    { value: `${m.winRate}%`, label: 'Win Rate' },
    { value: m.avgPerTurn, label: 'Avg / Turn' },
    { value: m.avgPerGame, label: 'Avg / Game' },
    isX01
      ? { value: m.bestTurn, label: 'Best Turn' }
      : { value: m.bestTurn, label: mode === 'cricket' ? 'Best Leg' : 'Best Turn' },
    isX01
      ? { value: m.bestScore, label: 'Best Finish' }
      : { value: m.bullDarts, label: 'Bull Darts' },
    isX01
      ? { value: m.checkoutAttempts > 0 ? `${m.checkoutPct}%` : '—', label: 'Checkout %' }
      : { value: m.maxDarts, label: 'Max Darts' }
  ];

  const section = document.createElement('div');
  section.className = 'stats-mode-card';
  section.innerHTML = `
    <h3 class="stats-mode-title">${modeTitles[mode] || mode}</h3>
    <div class="stats-grid stats-grid-4">
      ${cards.map(c => `<div class="stat-card"><div class="stat-value">${c.value}</div><div class="stat-label">${c.label}</div></div>`).join('')}
    </div>
  `;

  const misses = m.totalMisses || 0;
  const hits = Array.isArray(m.hits) ? m.hits : [];
  const dots = hits.filter(h => h && h.r <= 1);
  if (dots.length > 0) {
    const board = document.createElement('div');
    board.className = 'stats-board';
    board.appendChild(createBoardFace(dots));
    board.appendChild(boardMeta(m.totalDarts, misses));
    section.appendChild(board);
  } else {
    section.appendChild(boardMeta(m.totalDarts, misses));
  }
  return section;
}

function boardMeta(darts, misses) {
  const meta = document.createElement('div');
  meta.className = 'player-board-meta';
  meta.textContent = darts + ' darts · ' + misses + (misses === 1 ? ' miss' : ' misses');
  return meta;
}

// The bottom-most list entry: the recent-games history.
function buildGamesEntry() {
  const games = stats.games || [];

  const el = document.createElement('div');
  el.className = 'stats-entry';

  const header = document.createElement('div');
  header.className = 'stats-entry-header';
  header.innerHTML = `
    <span class="stats-chevron" aria-hidden="true">▶</span>
    <span class="stats-entry-name">Recent Games</span>
    <span class="stats-entry-summary">${games.length} ${games.length === 1 ? 'game' : 'games'}</span>
  `;
  header.addEventListener('click', () => el.classList.toggle('open'));

  const body = document.createElement('div');
  body.className = 'stats-entry-body';
  if (games.length === 0) {
    body.innerHTML = '<div class="stats-empty-inline">No games recorded yet.</div>';
  } else {
    games.slice().reverse().forEach(g => body.appendChild(buildRecentGameRow(g)));
  }

  el.appendChild(header);
  el.appendChild(body);
  return el;
}

function coloredName(name) {
  const color = playerColors[name.toLowerCase()];
  return color ? `<span style="color:${color}">${name}</span>` : name;
}

function buildRecentGameRow(g) {
  const date = new Date(g.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const modeLabel = g.mode === 'x01' ? `X01 ${g.x01Start}` : g.mode === 'shanghai' ? 'Shanghai' : 'Cricket';
  const scores = g.results.map(r => `${coloredName(r.name)} ${r.score}`).join(' · ');

  const row = document.createElement('div');
  row.className = 'recent-game';
  row.innerHTML = `
    <div class="recent-game-top">
      <span class="recent-game-date">${date}</span>
      <span class="recent-game-mode">${modeLabel}</span>
      <span class="recent-game-winner">${coloredName(g.winner)} wins</span>
    </div>
    <div class="recent-game-scores">${scores}</div>
  `;
  return row;
}

function totalGames(entry) {
  return (entry.modes.x01 ? entry.modes.x01.gamesPlayed : 0)
    + (entry.modes.cricket ? entry.modes.cricket.gamesPlayed : 0)
    + (entry.modes.shanghai ? entry.modes.shanghai.gamesPlayed : 0);
}
