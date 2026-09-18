// ===========================
// DART COUNTER - Scoring
// ===========================
'use strict';

function submitScore(forcedMult) {
  if (state.gameOver) return;

  const player = state.players[state.currentPlayerIndex];
  let throwValue = 0;
  let throwLabel = '';
  let marksEarned = {};

  if (input.special === '0') {
    throwValue = 0;
    throwLabel = 'MISS';
  } else if (input.special === 'bull') {
    throwValue = 25;
    throwLabel = 'Bull';
    if (state.mode === 'cricket') marksEarned['bull'] = 1;
  } else if (input.special === 'bulleye') {
    throwValue = 50;
    throwLabel = 'BE';
    if (state.mode === 'cricket') marksEarned['bull'] = 2;
  } else if (input.selected && input.number !== null) {
    const mult = forcedMult !== undefined ? forcedMult : input.multiplier;
    throwValue = input.number * mult;
    if (mult === 1) {
      throwLabel = `${input.number}`;
    } else if (mult === 2) {
      throwLabel = `D${input.number}`;
    } else {
      throwLabel = `T${input.number}`;
    }

    if (state.mode === 'cricket' && CRICKET_NUMBERS.includes(input.number)) {
      marksEarned[input.number] = mult;
    }
  } else {
    // No valid input — bail
    return;
  }

  // Process score based on mode
  let bust = false;
  let cricketResult = state.mode === 'cricket' ? null : undefined;
  if (state.mode === 'x01') {
    bust = processX01Score(player, throwValue, throwLabel);
  } else if (state.mode === 'cricket') {
    cricketResult = processCricketScore(player, throwValue, throwLabel, marksEarned);
  }

  // Track current turn throws
  if (!state._currentPlayerTurn) {
    state._currentPlayerTurn = {
      round: state.round,
      playerId: player.id,
      name: player.name,
      throws: [],
      values: [],
      _scoring: []
    };
  }

  if (bust) {
    state._currentPlayerTurn.throws.push(`${throwLabel} (BUST)`);
    state._currentPlayerTurn.values.push(throwValue);
    if (state.mode === 'cricket') state._currentPlayerTurn._scoring.push(false);
  } else {
    state._currentPlayerTurn.throws.push(throwLabel);
    state._currentPlayerTurn.values.push(throwValue);
  }

  // Track if this dart scored points (closed a number in cricket)
  if (state.mode === 'cricket' && cricketResult && cricketResult.scored) {
    state._currentPlayerTurn._scoring[state._currentPlayerTurn.values.length - 1] = true;
  }

  state.throwCount++;

  // If player finished mid-turn, end the turn immediately
  if (cricketResult?.finished || (state.mode === 'x01' && player.finished)) {
    state.throwCount = SCORES_PER_TURN;
  }

  // X01 bust ends the turn — remaining darts count as misses.
  // Auto-misses count as darts (player.turns) so undoing them stays balanced.
  if (bust) {
    while (state.throwCount < SCORES_PER_TURN) {
      state._currentPlayerTurn.throws.push('MISS');
      state._currentPlayerTurn.values.push(0);
      player.turns++;
      state.throwCount++;
    }
  }

  // Check if turn is complete (3 scores)
  if (state.throwCount >= SCORES_PER_TURN) {
    // Complete the turn — add to history
    let turnTotal;
    if (state.mode === 'x01') {
      // For X01, total excludes busted values
      turnTotal = state._currentPlayerTurn.values.reduce(
        (sum, val, i) => sum + (state._currentPlayerTurn.throws[i] && state._currentPlayerTurn.throws[i].includes('BUST') ? 0 : val), 0
      );
    } else {
      // Cricket: only count points from darts that closed a number
      turnTotal = state._currentPlayerTurn.values.reduce((sum, val, i) => {
        if (state._currentPlayerTurn._scoring && state._currentPlayerTurn._scoring[i]) return sum + val;
        return sum;
      }, 0);
    }
    state._currentPlayerTurn.total = turnTotal;
    state.history.push(state._currentPlayerTurn);

    state._currentPlayerTurn = null;

    // Move to next unfixed player
    let nextIdx = (state.currentPlayerIndex + 1) % state.players.length;
    let safety = 0;
    while (state.players[nextIdx].finished && safety < state.players.length) {
      nextIdx = (nextIdx + 1) % state.players.length;
      safety++;
    }
    state.currentPlayerIndex = nextIdx;

    // Check game over: all but one finished
    const finishedCount = state.players.filter(p => p.finished).length;
    if (finishedCount >= state.players.length - 1 && finishedCount > 0) {
      endGame();
      return;
    }

    // Reset for next player's turn
    state.throwCount = 0;
    state.round++;
  }

  // Clear input for next throw
  clearInput();

  // Save state and render
  saveGameState();
  renderGame();
}

function processX01Score(player, value, label) {
  const scoreBeforeTurn = player.score;
  player.score -= value;
  player.runs += value;
  player.turns++;

  // Check for bust
  if (player.score < 0) {
    player.score = scoreBeforeTurn;  // Revert score
    player.runs -= value;             // Revert runs
    player.turns--;                   // Revert turn
    return true;  // Bust
  }

  // Check if player finished (score === 0)
  if (player.score === 0) {
    player.finished = true;
  }

  return false;
}

function processCricketScore(player, value, label, marksEarned) {
  player.turns++;

  // Apply marks
  let scored = false;
  for (const [num, count] of Object.entries(marksEarned)) {
    const key = typeof num === 'number' ? num : num;
    const marksBefore = player.marks[key] || 0;
    player.marks[key] = Math.min(marksBefore + count, CRICKET_TARGET_MARKS);
    // Score when hitting an already-closed target (4th hit onward) AND not all players have closed it
    if (marksBefore >= CRICKET_TARGET_MARKS) {
      const allPlayersClosed = state.players.every(p => (p.marks[key] || 0) >= CRICKET_TARGET_MARKS);
      if (!allPlayersClosed) {
        scored = true;
      }
    }
  }

  if (scored) player.runs += value;

  const allMarked = CRICKET_NUMBERS.every(n => player.marks[n] >= CRICKET_TARGET_MARKS)
    && player.marks['bull'] >= CRICKET_TARGET_MARKS;

  if (allMarked && !player.finished) {
    player.finished = true;
    return { finished: true, scored };
  }
  return { finished: false, scored };
}
