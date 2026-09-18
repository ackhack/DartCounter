// ===========================
// DART COUNTER - Undo
// ===========================
'use strict';

function undoLast() {
  if (state.gameOver) return;

  // Case 1: Incomplete turn — pop the last dart from the current in-progress turn
  if (state._currentPlayerTurn && state._currentPlayerTurn.throws.length > 0) {
    const turn = state._currentPlayerTurn;
    const player = state.players[state.currentPlayerIndex];

    const dartIndex = turn.throws.length - 1;
    const scored = turn._scoring[dartIndex];
    const lastLabel = turn.throws.pop();
    const lastValue = turn.values.pop();

    revertPlayerStats(player, lastValue, lastLabel, scored);
    state.throwCount = Math.max(0, state.throwCount - 1);

    // Clean up empty turn to prevent broken state on repeated undo
    if (turn.throws.length === 0) {
      delete state._currentPlayerTurn;
      // Shared array — the history entry behind it is also empty now.
      // Remove it so undo doesn't need an extra click to clean up leftovers.
      const lastHistory = state.history[state.history.length - 1];
      if (lastHistory && lastHistory.throws.length === 0) {
        state.history.pop();
      }
    }

    clearInput();
    saveGameState();
    renderGame();
    return;
  }

  // Case 2: Completed turn — pop the last dart from the last history entry
  if (state.history.length === 0) return;

  const lastEntry = state.history[state.history.length - 1];
  if (lastEntry.throws.length === 0) {
    // Entry has no more darts — just remove it
    state.history.pop();
    clearInput();
    saveGameState();
    renderGame();
    return;
  }

  const dartIndex = lastEntry.throws.length - 1;
  const scored = lastEntry._scoring?.[dartIndex] || false;
  const lastLabel = lastEntry.throws.pop();
  const lastValue = lastEntry.values.pop();
  const player = state.players.find(p => p.id === lastEntry.playerId);
  if (!player) return;

  revertPlayerStats(player, lastValue, lastLabel, scored);

  // If the entry is now empty, remove it entirely
  if (lastEntry.throws.length === 0) {
    state.history.pop();
    // Entry consumed — no turn to restore, game moves forward
  } else {
    // Entry still has remaining darts — share the arrays directly so
    // Case 1 pops on the same underlying arrays (slice() caused a bug
    // where Case 1 modifications didn't affect history, allowing extra undos)
    state._currentPlayerTurn = {
      round: lastEntry.round,
      playerId: lastEntry.playerId,
      name: lastEntry.name,
      throws: lastEntry.throws,  // Direct reference, no copy
      values: lastEntry.values,  // Direct reference, no copy
      _scoring: lastEntry._scoring,  // Direct reference, no copy
      total: lastEntry.values.reduce((a, b) => a + b, 0)
    };

    // Put the undone player back in the active slot via their array index
    const undonePlayerIndex = state.players.findIndex(
      p => p.id === lastEntry.playerId
    );
    state.currentPlayerIndex = undonePlayerIndex;
    state.throwCount = state._currentPlayerTurn.throws.length;
  }

  clearInput();
  saveGameState();
  renderGame();
}

function revertPlayerStats(player, value, throwLabel, scored) {
  if (throwLabel && throwLabel.includes('BUST')) {
    // Bust — everything was already reverted in processX01Score
    return;
  }

  if (state.mode === 'x01') {
    player.score += value;
    player.runs -= value;
    player.turns--;
    if (player.score > 0) player.finished = false;
  } else if (state.mode === 'cricket') {
    const marksToUndo = getMarksForThrow(throwLabel);
    // Reverse marks
    for (const [num, count] of Object.entries(marksToUndo)) {
      const key = typeof num === 'number' ? num : num;
      player.marks[key] = Math.max(0, (player.marks[key] || 0) - count);
    }

    // Only subtract runs if this dart was scoring
    if (scored) player.runs -= value;
    player.turns--;

    // Unfinish if not all marks are closed
    const stillClosed = CRICKET_NUMBERS.every(n => (player.marks[n] || 0) >= CRICKET_TARGET_MARKS)
      && (player.marks['bull'] || 0) >= CRICKET_TARGET_MARKS;
    if (!stillClosed) player.finished = false;
  }
}

function getMarksForThrow(label) {
  const marks = {};
  if (!label) return marks;

  const trimmed = label.replace(' (BUST)', '');
  if (trimmed === 'Bull') {
    marks['bull'] = 1;
  } else if (trimmed === 'BE' || trimmed === 'BullsEye') {
    marks['bull'] = 2;
  } else if (trimmed.startsWith('D')) {
    const num = parseInt(trimmed.substring(1));
    if (!isNaN(num) && CRICKET_NUMBERS.includes(num)) marks[num] = 2;
  } else if (trimmed.startsWith('T')) {
    const num = parseInt(trimmed.substring(1));
    if (!isNaN(num) && CRICKET_NUMBERS.includes(num)) marks[num] = 3;
  } else {
    const num = parseInt(trimmed);
    if (!isNaN(num) && CRICKET_NUMBERS.includes(num)) marks[num] = 1;
  }
  return marks;
}
