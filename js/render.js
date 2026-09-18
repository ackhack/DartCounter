// ===========================
// DART COUNTER - Rendering
// ===========================
'use strict';

function renderGame() {
  const player = state.players[state.currentPlayerIndex];

  // Clear cricket marks DOM before populating (prevents stale checkmarks from prev games)
  const cricketSection = $('#cricket-marks-section');
  if (state.mode === 'cricket') {
    cricketSection.style.display = 'grid !important';
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
        // Blue when every player has closed this number, like the mark-dots
        const allPlayersClosed = state.players.every(pl => (pl.marks[n] || 0) >= CRICKET_TARGET_MARKS);
        const cls = allPlayersClosed ? 'closed-all' : (m >= CRICKET_TARGET_MARKS ? 'closed' : (m > 0 ? 'filled' : ''));
        marksPreview += `<span class="queue-mark ${cls}"></span>`;
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
