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
  const show = state.mode === 'x01' && input.multiplier > 1;
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
}
