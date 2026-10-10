// ===========================
// DART COUNTER - Rendering
// ===========================
'use strict';

function renderGame() {
  console.log('renderGame')

  const player = state.players[state.currentPlayerIndex];

  // Header info
  if (isShanghai()) {
    // The "round" is the current target, not a turn counter.
    const reached = Math.min(state.shanghaiIndex + 1, SHANGHAI_TARGETS.length);
    $('#round-label').textContent = `Number ${reached} / ${SHANGHAI_TARGETS.length}`;
    $('#finish-count').textContent = '';
  } else {
    $('#round-label').textContent = `Round ${state.round}`;
    const finishedCount = state.players.filter(p => p.finished).length;
    const remaining = state.players.length - finishedCount;
    $('#finish-count').textContent = remaining > 1 ? `${remaining} Players left` : '';
  }

  // Active player name — the card's border/glow color comes from the same
  // player color; fall back to the neutral border when there is none.
  const activeNameEl = $('#active-player-name');
  activeNameEl.textContent = player.name;
  activeNameEl.style.color = player.color || '';
  $('#active-player-card').style.setProperty('--player-color', player.color || 'var(--border)');

  // Active player points
  if (isX01()) {
    // A finished X01 player sits on 0 — show a party emoji instead.
    $('#active-player-score').textContent = player.score === 0 ? '🎉' : player.score;
  } else {
    $('#active-player-score').textContent = player.runs;
  }

  // Throws display — use in-progress turn throws if available
  let throwsToShow = [];
  if (state._currentPlayerTurn) {
    throwsToShow = state._currentPlayerTurn.throws;
  }
  for (let i = 0; i < SCORES_PER_TURN; i++) {
    const slot = $(`#throw-${i}`);
    if (i < throwsToShow.length) {
      slot.textContent = throwsToShow[i];
      slot.classList.add('filled');
    } else {
      slot.innerHTML = '<span class="throw-empty">-</span>';
      slot.classList.remove('filled');
    }
  }

  renderShanghaiNumberHighlight();

  renderThrowLog();

  if (isCricket()) {
    // Player list is hidden in cricket — the scoreboard carries names,
    // marks and points instead.
    renderCricketMarksGrid();
  } else {
    // Player cards
    renderPlayers();
  }
}

// Shanghai: highlight the one number that scores this round and dim the rest.
// Non-Shanghai modes get a clean grid (classes removed).
function renderShanghaiNumberHighlight() {
  $$('.num-btn').forEach(btn => btn.classList.remove('current', 'dimmed'));
  $$('.special-btn').forEach(btn => btn.classList.remove('current', 'dimmed'));
  if (!isShanghai() || state.shanghaiIndex >= SHANGHAI_TARGETS.length) return;

  const target = currentShanghaiTarget();
  if (target === BULL_NUMBER) {
    // Bull round — bull/bulls-eye are the scoring buttons.
    $$('.num-btn').forEach(btn => btn.classList.add('dimmed'));
    $$('.special-btn').forEach(btn => {
      const s = btn.dataset.special;
      if (s === 'bull' || s === 'bulleye') btn.classList.add('current');
      // MISS stays normal — it is always throwable.
    });
  } else {
    $$('.num-btn').forEach(btn => {
      const isCurrent = parseInt(btn.dataset.num) === target;
      btn.classList.toggle('current', isCurrent);
      btn.classList.toggle('dimmed', !isCurrent);
    });
    $$('.special-btn').forEach(btn => {
      if (btn.dataset.special !== '0') btn.classList.add('dimmed');
    });
  }
}

// Throw History tape — every inputted dart as a small chip, oldest on the
// left and newest on the right. Rebuilt from state.throwLog (append-only, so
// undo never shrinks it), then the scroll is pinned to the newest (rightmost).
function renderThrowLog() {
  const el = $('#throw-log');
  if (!el) return;
  el.innerHTML = state.throwLog.map(t =>
    `<span class="throw-log-chip" style="color:${t.color || 'var(--text-secondary)'}">${t.label}</span>`
  ).join('');
  el.scrollLeft = el.scrollWidth;
}

// Cricket scoreboard — in cricket it replaces the player list: the header
// row holds the numbers to hit, each player is a row with the 3 dots for
// each number (same dot states as the old per-player preview) and their
// points at the right.
function renderCricketMarksGrid() {
  const grid = $('#cricket-marks-grid');
  if (!grid) return;

  let html = '<span class="marks-grid-corner"></span>';
  CRICKET_NUMBERS.forEach(n => {
    html += `<span class="marks-grid-num">${n === BULL_NUMBER ? 'B' : n}</span>`;
  });
  html += '<span class="marks-grid-points-label">Pts</span>';

  state.players.forEach(p => {
    if (p.finished) return;
    html += `<span class="marks-grid-name" style="color:${p.color || ''}">${p.name}</span>`;
    CRICKET_NUMBERS.forEach(n => {
      const m = p.marks[n] || 0;
      let dots = '';
      for (let d = 0; d < CRICKET_TARGET_MARKS; d++) {
        const dotCls = cricketAllPlayersClosed(n) ? 'closed-all' : (m >= CRICKET_TARGET_MARKS ? 'closed' : (d < m ? 'filled' : ''));
        dots += `<span class="marks-grid-dot ${dotCls}"></span>`;
      }
      html += `<span class="marks-grid-cell">${dots}</span>`;
    });
    html += `<span class="marks-grid-points">${p.runs}</span>`;
  });

  grid.innerHTML = html;
}

function renderPlayers() {
  const container = $('#players-list');
  container.innerHTML = '';

  // Every player as a card, in fixed play order (the order they were added).
  const activeIdx = state.currentPlayerIndex;

  state.players.forEach((p, i) => {
    if (p.finished) return;

    const isActive = i === activeIdx;

    const card = document.createElement('div');
    card.className = 'player-card' + (isActive ? ' active' : '');
    if (isActive && p.color) {
      card.style.borderColor = p.color;
    }

    const scoreText = isX01() ? p.score : `${p.runs} points`;

    // Last 5 completed turns of this player, newest first.
    // The in-progress turn is already visible in the big active player card.
    const turns = state.history.filter(h => h.playerId === p.id).slice(-5).reverse();
    const historyHtml = isCricket() ? '' : '<div class="player-history">' + turns.map(entry => `
      <div class="player-history-entry">
        <span class="player-history-round">R${entry.round}</span>
        <div class="player-history-throws">${entry.throws.map(t => `<span class="player-history-throw">${t}</span>`).join('')}</div>
        <span class="player-history-total">${entry.total > 0 ? entry.total : ''}</span>
      </div>
    `).join('') + '</div>';

    card.innerHTML = `
      <div class="player-card-header">
        <span class="player-card-name"${p.color ? ` style="color:${p.color}"` : ''}>${p.name}</span>
        <span class="player-card-score ${p.finished ? 'finished' : ''}">${scoreText}</span>
      </div>
      ${historyHtml}
    `;

    container.appendChild(card);
    if (isActive)
      card.scrollIntoView({ block: "start", container: "nearest" });
  });
}
