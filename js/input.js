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
  input.hit = null;

  $$('.num-btn').forEach(btn => btn.classList.remove('selected'));
  $$('.mult-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === 0);
  });
  $$('.special-btn').forEach(btn => btn.classList.remove('selected'));

  updateUndoButton();
  updateMultiplierPreview();
}

function updateMultiplierPreview() {
  // X01 previews every number; Shanghai only the current target (the only
  // one that scores); in cricket the multiplier adds marks, not a score.
  // A pending multiplier (>1) only exists right after Double/Triple is
  // pressed, before a number, so this is the state the preview describes.
  const mult = input.multiplier;
  $$('.num-btn').forEach(btn => {
    const num = parseInt(btn.dataset.num);
    const show = mult > 1 && (isX01() || (isShanghai() && num === currentShanghaiTarget()));
    if (show) {
      btn.dataset.multPreview = String(num * mult);
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

// Default ideal for a dart with no recorded aim and no X01 checkout
// suggestion: the standard primary target.
const DEFAULT_PLAYER_AIM = 'T20';

// The field a player was aiming at when their next dart lands:
//   X01      — the first dart of the checkout suggestion (CPU_CHECKOUT_CHART,
//              the same hint the active player card shows, gated the same
//              way: only when the whole checkout fits in the remaining darts)
//   cricket  — the CPU's aim (triple of the suggested number, see
//              cpuCricketIdeal, js/cpu.js)
//   Shanghai — the CPU's aim (win-combo multiplier or triple for points,
//              see cpuShanghaiIdeal, js/cpu.js)
//   else     — DEFAULT_PLAYER_AIM (js/polar.js)
// applyThrowToken (js/input.js) stamps this on bridge darts at throw time;
// CPU darts carry their own planned field as the aim instead.
function playerAimDart(player, dartsLeft) {
  if (isX01()) {
    const checkout = player ? CPU_CHECKOUT_CHART[player.score] : null;
    if (checkout && checkout.length <= dartsLeft) return checkout[0];
  }
  if (isCricket() && player) return cpuCricketIdeal(player);
  // The bridge can still post a dart in the 3s window after the bull round
  // finished — no current target anymore, so no aim either.
  if (isShanghai() && state.shanghaiIndex < SHANGHAI_TARGETS.length) return cpuShanghaiIdeal();
  return DEFAULT_PLAYER_AIM;
}

// Turn a single token ("T20", "D20", "20", "Bull", "BE", "0") into the
// input state submitScore() expects for one dart. The optional hit
// ({ r, angle, field, ideal? }) is where the dart actually landed (CPU aim
// or DartIt camera) — submitScore() records it on the turn. A hit without
// a recorded aim (bridge darts) gets the throw-time ideal stamped on
// (playerAimDart, live score) so the end boards can show what it aimed at.
// Manual input passes no hit — no recorded landing, no ideal.
function applyThrowToken(token, hit) {
  input.number = null;
  input.multiplier = 1;
  input.special = null;

  if (hit) {
    const player = state.players[state.currentPlayerIndex];
    // Pass the player object — playerAimDart reads player.score for the
    // X01 checkout row and hands the object to cpuCricketIdeal (marks).
    input.hit = hit.ideal ? hit : { ...hit, ideal: playerAimDart(player, SCORES_PER_TURN - state.throwCount) };
  } else {
    input.hit = null;
  }

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
