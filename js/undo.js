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
    state.throwCount = SCORES_PER_TURN;
    state.currentPlayerIndex--;
    if (state.currentPlayerIndex < 0) {
      state.currentPlayerIndex = state.players.length - 1;
    }
    // Shanghai: the target may have advanced after this turn completed —
    // restore the one it was played on.
    if (isShanghai()) {
      state.shanghaiIndex = state._currentPlayerTurn.shanghaiIndex;
      state.shanghaiTurnsAtNumber = state.history.filter(h => h.shanghaiIndex === state.shanghaiIndex).length;
    }
  }

  const turn = state._currentPlayerTurn;
  const player = state.players[state.currentPlayerIndex];

  revertPlayerStats(player, turn);
  state.throwCount = Math.max(0, state.throwCount - 1);

  // Clean up empty turn to prevent broken state on repeated undo
  if (turn.throws.length === 0) {
    delete state._currentPlayerTurn;
  }

  clearInput();
  renderGame();
}

function revertPlayerStats(player, turn) {
  const dartIndex = turn.throws.length -1;
  const scored = turn._scoring[dartIndex];
  const throwLabel = turn.throws.pop();
  const value = turn.values.pop();

  player.turns--;
  if (throwLabel && throwLabel.includes('BUST')) {
    console.log('undoing bust')
    //subtract all scores from previous hits this turn, as they count now again.
    turn.values.forEach(v => {
      player.score -= v[2];
      player.runs += v[2];
    });
  } else if (isX01()) {
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
  } else if (isShanghai()) {
    // Only subtract runs if this dart was scoring
    if (scored > 0) {
      player.runs -= scored;
    }

    // Undoing the winning dart of an instant win un-finishes the player.
    if (player.finished) {
      player.finished = false;
      player.currentGamePosition = 0;
    }
  }
}
