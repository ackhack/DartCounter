// ===========================
// DART COUNTER - Input Handling
// ===========================
'use strict';

function selectNumber(num) {
  input.number = num;
  input.special = null;

  // Save the current multiplier value, update UI, then score before resetting
  const currentMult = input.multiplier;

  // Update UI
  $$('.num-btn').forEach(btn => {
    btn.classList.toggle('selected', parseInt(btn.dataset.num) === num);
  });
  $$('.mult-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.mult) === 1);
  });
  $$('.special-btn').forEach(btn => btn.classList.remove('selected'));

  // Reset multiplier for next throw
  input.multiplier = 1;

  updateUndoButton();

  // Instant scoring — use saved multiplier before reset
  submitScore(currentMult);
}

function selectMultiplier(mult) {
  input.multiplier = mult;
  input.special = null;
  updateMultiplierPreview();

  $$('.mult-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.mult) === mult);
  });
}

function selectSpecial(type) {
  input.number = null;
  input.multiplier = 1;
  input.special = type;

  $$('.mult-btn').forEach(btn => btn.classList.remove('active'));
  $$('.special-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.special === type);
  });

  updateUndoButton();

  // Instant scoring
  submitScore();
}

function clearInput() {
  input.number = null;
  input.multiplier = 1;
  input.special = null;

  $$('.num-btn').forEach(btn => btn.classList.remove('selected'));
  $$('.mult-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === 0);
  });
  $$('.special-btn').forEach(btn => btn.classList.remove('selected'));

  updateUndoButton();
  updateMultiplierPreview();
}

function updateMultiplierPreview() {
  // X01 only — in cricket the multiplier adds marks, not a score preview.
  // A pending multiplier (>1) only exists right after Double/Triple is
  // pressed, before a number, so this is the state the preview describes.
  const show = isX01() && input.multiplier > 1;
  $$('.num-btn').forEach(btn => {
    if (show) {
      btn.dataset.multPreview = String(parseInt(btn.dataset.num) * input.multiplier);
    } else {
      delete btn.dataset.multPreview;
    }
  });
}

function updateUndoButton() {
  const undoBtn = $('#undo-btn');
  // Enable undo if there's an incomplete turn or completed history to undo
  undoBtn.disabled = !state._currentPlayerTurn && state.history.length === 0 || state.gameOver;
  $('#next-btn').disabled = !state.gameStarted || state.gameOver;
}

// Turn a single token ("T20", "D20", "20", "Bull", "BE", "0") into the
// input state submitScore() expects for one dart.
function applyThrowToken(token) {
  input.number = null;
  input.multiplier = 1;
  input.special = null;

  const t = token.trim().toUpperCase();
  if (t === 'BULL') {
    input.special = 'bull';
  } else if (t === 'BE' || t === 'BULLSEYE') {
    input.special = 'bulleye';
  } else if (t === '0' || t === 'MISS') {
    input.special = '0';
  } else {
    let mult = 1;
    let numStr = t;
    if (t.startsWith('T')) {
      mult = 3;
      numStr = t.slice(1);
    } else if (t.startsWith('D')) {
      mult = 2;
      numStr = t.slice(1);
    }
    const num = parseInt(numStr, 10);
    if (!Number.isNaN(num)) {
      input.number = num;
      input.multiplier = mult;
    }
  }
}

// Submit a quick-turn preset (e.g. "T20 20 20") dart by dart, reusing the
// normal scoring path. It fills the current player's remaining darts and stops
// the instant the turn ends (bust, checkout, or game over), so it can never
// score a dart onto the next player. Each dart stays individually undoable.
function submitPresetTurn(tokens) {
  if (state.gameOver) return;

  const startIdx = state.currentPlayerIndex;
  for (const token of tokens) {
    if (state.gameOver || state.currentPlayerIndex !== startIdx) break;
    applyThrowToken(token);
    submitScore();
  }
}

// Score MISS for the current player's remaining darts, handing the turn to
// the next player. Reuses the normal scoring path so each miss lands in turn
// history and stays individually undoable. The turn-end path resets throwCount
// and advances the player, so the index check is what stops the loop.
function skipToNextPlayer() {
  if (state.gameOver) return;
  const startIdx = state.currentPlayerIndex;
  while (state.throwCount < SCORES_PER_TURN && state.currentPlayerIndex === startIdx && !state.gameOver) {
    applyThrowToken('0');
    submitScore();
  }
}
