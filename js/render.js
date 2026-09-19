// ===========================
// DART COUNTER - Rendering
// ===========================
'use strict';

function renderGame() {
  console.log('renderGame')

  const player = state.players[state.currentPlayerIndex];

  // Header info
  $('#round-label').textContent = `Round ${state.round}`;
  const finishedCount = state.players.filter(p => p.finished).length;
  const remaining = state.players.length - finishedCount;
  $('#finish-count').textContent = remaining > 1 ? `${remaining} Players left` : '';

  // Active player name
  $('#active-player-name').textContent = player.name;

  // Active player points
  if (state.mode === 'x01') {
    $('#active-player-score').textContent = player.score;
    $('#active-score-label').textContent = 'Remaining';
  } else {
    $('#active-player-score').textContent = player.runs;
    $('#active-score-label').textContent = 'Points';
  }
  $('#active-runs').textContent = state.mode === 'cricket' ? `` : `${player.runs} points`;

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

  // Cricket marks - already cleared above, now populate from player data
  if (state.mode === 'cricket')
    renderCricketMarks(player);

  // Queue
  renderQueue();

  // History
  renderHistory();
}

function renderCricketMarks(player) {
  CRICKET_NUMBERS.forEach(n => {
    updateMarkDisplay(`marks-${n}`, player.marks[n] || 0, false, n);
  });
}

function updateMarkDisplay(elementId, marks, isBull, number) {
  const el = $(`#${elementId}`);
  if (!el) return;
  const dotsEl = el.querySelector('.mark-dots');
  if (!dotsEl) return;

  dotsEl.innerHTML = '';
  const closed = marks >= CRICKET_TARGET_MARKS;
  const allPlayersClosed = state.players.every(p => (p.marks[number] || 0) >= CRICKET_TARGET_MARKS);

  for (let i = 0; i < CRICKET_TARGET_MARKS; i++) {
    const dot = document.createElement('span');
    dot.className = 'mark-dot';
    if (allPlayersClosed) {
      dot.classList.add('closed-all');
    } else if (closed) {
      dot.classList.add('all-filled');
    } else if (i < marks) {
      dot.classList.add('filled');
    }
    dotsEl.appendChild(dot);
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
    if (p.finished) return;

    const el = document.createElement('div');
    el.className = 'queue-player';

    let scoreText;
    if (state.mode === 'x01') {
      scoreText = p.score;
    } else {
      scoreText = `${p.runs} points`;
    }

    let marksPreview = '';
    if (state.mode === 'cricket' && !p.finished) {
      marksPreview = '<div class="queue-marks-preview">';
      CRICKET_NUMBERS.forEach(n => {
        const m = p.marks[n] || 0;
        // Blue when every player has closed this number, like the mark-dots
        const allPlayersClosed = state.players.every(pl => (pl.marks[n] || 0) >= CRICKET_TARGET_MARKS);
        const label = n === BULL_NUMBER ? 'B' : String(n);
        let dots = '';
        for (let d = 0; d < CRICKET_TARGET_MARKS; d++) {
          const dotCls = allPlayersClosed ? 'closed-all' : (m >= CRICKET_TARGET_MARKS ? 'closed' : (d < m ? 'filled' : ''));
          dots += `<span class="queue-mark-dot ${dotCls}"></span>`;
        }
        marksPreview += `<span class="queue-mark">${label}${dots}</span>`;
      });
      marksPreview += '</div>';
    }

    el.innerHTML = `
      <div class="queue-player-info">
        <span class="queue-position">${i + 1}</span>
        <span class="queue-player-name">${p.name}</span>
      </div>
      ${marksPreview}
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
    entries.forEach(entry => container.appendChild(createHistoryEntryEl(entry)));
  } else {
    const existingTotal = container.children.length;
    const newCount = entries.length;

    if (newCount > existingTotal) {
      // A new entry was added — it's the first in the reversed array
      // Insert at the top (newest first)
      container.prepend(createHistoryEntryEl(entries[0]));
    } else if (newCount < existingTotal) {
      // Count decreased (undo removed entry) — rebuild without animation
      container.innerHTML = '';
      entries.forEach(entry => container.appendChild(createHistoryEntryEl(entry, true)));
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

function createHistoryEntryEl(entry, noAnim = false) {
  const el = document.createElement('div');
  el.className = noAnim ? 'history-entry no-anim' : 'history-entry';
  el.innerHTML = `
    <span class="history-round">R${entry.round}</span>
    <span class="history-player">${entry.name}</span>
    <div class="history-throws">${entry.throws.map(t => `<span class="history-throw">${t}</span>`).join('')}</div>
    <span class="history-total">${entry.total > 0 ? entry.total : ''}</span>
  `;
  return el;
}
