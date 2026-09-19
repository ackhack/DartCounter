// ===========================
// DART COUNTER - Undo
// ===========================
'use strict';

function undoLast() {
  if (state.gameOver) return;

  //if current player is not set or has not thrown, we use the last entry in history
  if (state._currentPlayerTurn == null || state._currentPlayerTurn.throws.length == 0) {
    if (state.history.length === 0) return;
    state._currentPlayerTurn = state.history.pop();
    state.currentPlayerIndex--;
    if (state.currentPlayerIndex < 0) {
      state.currentPlayerIndex = state.players.length - 1;
    }
  }

  const turn = state._currentPlayerTurn;
  const player = state.players[state.currentPlayerIndex];
  const dartIndex = turn.throws.length -1;
  const scored = turn._scoring[dartIndex];
  const lastLabel = turn.throws.pop();
  const lastValue = turn.values.pop();

  revertPlayerStats(player, lastValue, lastLabel, scored);
  state.throwCount = Math.max(0, state.throwCount - 1);

  // Clean up empty turn to prevent broken state on repeated undo
  if (turn.throws.length === 0) {
    delete state._currentPlayerTurn;
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
  player.turns--;
  if (isX01()) {
    player.score += value[2];
    player.runs -= value[2];
    if (player.score > 0) {
      player.finished = false;
      player.currentGamePosition = 0;
    }
  } else if (isCricket()) {
    // Only subtract runs if this dart was scoring
    if (scored > 0) {
      player.runs -= scored;
      console.log(scored + " removed")
    }

    //fully multiplied points minus the points that were used for scoring divided by the base value
    //equals the amount of multiplier that was used for marks
    const marksToRemove = Math.round((value[2] - scored) / value[0]);
    console.log(marksToRemove)
    player.marks[value[0]] = Math.max(0, (player.marks[value[0]] || 0) - marksToRemove);

    // Unfinish if not all marks are closed
    const stillClosed = CRICKET_NUMBERS.every(n => (player.marks[n] || 0) >= CRICKET_TARGET_MARKS);
    if (!stillClosed) {
      player.finished = false;
      player.currentGamePosition = 0;
    }
  }
}
