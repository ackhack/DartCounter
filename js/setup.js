// ===========================
// DART COUNTER - Event Listeners & Setup Screen
// ===========================
'use strict';

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
  $('#start-game-btn').addEventListener('click', startFirstGame);

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

  // Quick-turn presets (X01) — submit a full 3-dart turn in one tap
  $$('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => submitPresetTurn(btn.dataset.turn.split(/\s+/)));
  });
}

function updateSetupVisibility() {
  $('#game-mode-label').textContent = state.mode === 'x01' ? 'X01' : 'Cricket';

  const x01Opts = $('#x01-options');
  if (x01Opts) {
    x01Opts.style.display = state.mode === 'x01' ? 'block' : 'none';
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