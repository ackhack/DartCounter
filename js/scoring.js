// ===========================
// DART COUNTER - Scoring
// ===========================
'use strict';

function submitScore(forcedMult) {
  let mult = forcedMult !== undefined ? forcedMult : input.multiplier;
  if (state.gameOver) return;

  const player = state.players[state.currentPlayerIndex];
  if (player.finished) return;//idk why we would hit this

  let throwValue = 0;
  let throwLabel = '';

  if (input.special === '0') {
    throwValue = 0;
    throwLabel = 'Miss';
  } else if (input.special === 'bull') {
    throwValue = 25;
    throwLabel = 'Bull';
  } else if (input.special === 'bulleye') {
    throwValue = 25;
    mult = 2;
    throwLabel = 'BE';
  } else if (input.number !== null) {
    if (mult === 1) {
      throwLabel = `${input.number}`;
    } else if (mult === 2) {
      throwLabel = `D${input.number}`;
    } else {
      throwLabel = `T${input.number}`;
    }
  } else {
    // No valid input — bail
    return;
  }

  //update counts
  player.turns++;
  state.throwCount++;

  // If first throw of turn, initialize the turn object
  if (!state._currentPlayerTurn) {
    state._currentPlayerTurn = {
      round: state.round,
      playerId: player.id,
      name: player.name,
      throws: [],
      values: [],
      _scoring: [],
      startingScore: player.score,
      startingRuns: player.runs
    };
  }

  // Process score based on mode
  let bust = false;
  let cricketResult = state.mode === 'cricket' ? null : undefined;
  if (state.mode === 'x01') {
    bust = processX01Score(player, throwValue * mult);
  } else if (state.mode === 'cricket') {
    cricketResult = processCricketScore(player, throwValue, mult);
  }

  // Update the current turn object with the throw result
  state._currentPlayerTurn.throws.push(bust ? `${throwLabel} (BUST)` : throwLabel);
  state._currentPlayerTurn.values.push([throwValue, mult, throwValue * mult]);

  // X01 bust ends the turn — remaining darts count as misses.
  // Auto-misses count as darts (player.turns) so undoing them stays balanced.
  if (bust) {
    while (state.throwCount < SCORES_PER_TURN) {
      state._currentPlayerTurn.throws.push('MISS');
      state._currentPlayerTurn.values.push([0, 1, 0]);
      state.throwCount++;
    }
  } else {
    //Track if this dart scored points (closed a number in cricket)
    if (state.mode === 'cricket' && cricketResult) {
      state._currentPlayerTurn._scoring[state.throwCount] = cricketResult.scored;
    } else {
      state._currentPlayerTurn._scoring[state.throwCount] = 0;
    }

    // If player finished mid-turn, end the turn immediately
    if (cricketResult?.finished || (state.mode === 'x01' && player.finished)) {
      state.throwCount = SCORES_PER_TURN;
    }
  }

  // Check if turn is complete (3 scores)
  if (state.throwCount >= SCORES_PER_TURN) {
    // Complete the turn — add to history
    let turnTotal;

    // Calculate turn total based on mode
    if (state.mode === 'x01') {
      // For X01, total excludes busted values
      turnTotal = state._currentPlayerTurn.values.reduce(
        (sum, val, i) => sum + (state._currentPlayerTurn.throws[i] && state._currentPlayerTurn.throws[i].includes('BUST') ? 0 : val[2]), 0
      );
    } else {
      // Cricket: only count points from darts that hit a scoring number
      turnTotal = state._currentPlayerTurn.values.reduce((sum, val, i) => {
        if (state._currentPlayerTurn._scoring && state._currentPlayerTurn._scoring[i]) return sum + val[2];
        return sum;
      }, 0);
    }

    // Update history, reset current turn
    state._currentPlayerTurn.total = turnTotal;
    state.history.push(state._currentPlayerTurn);
    state._currentPlayerTurn = null;

    // Move to next player
    let nextIdx = (state.currentPlayerIndex + 1) % state.players.length;
    let safety = 0;
    while (state.players[nextIdx].finished && safety < state.players.length) {
      nextIdx = (nextIdx + 1) % state.players.length;
      safety++;
    }
    state.currentPlayerIndex = nextIdx;

    // Check game over: all but one finished
    if (state.players.every(p => p.finished)) {
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

function processX01Score(player, value) {
  player.score -= value;
  player.runs += value;

  // Check for bust
  if (player.score < 0) {
    player.score = state._currentPlayerTurn.startingScore;
    player.runs = state._currentPlayerTurn.startingRuns;
    return true;  // Bust
  }

  // Check if player finished (score === 0)
  if (player.score === 0) {
    player.finished = true;
  }

  return false;
}

function processCricketScore(player, value, multiplier) {
  let scored = 0;
  //only do scoring if not all players have closed the number
  const allPlayersClosed = state.players.every(p => (p.marks[value] || 0) >= CRICKET_TARGET_MARKS);
  if (!allPlayersClosed) {

    // Score when hitting an already-closed target (4th hit onward) AND not all players have closed it
    const marksBefore = player.marks[value] || 0;
    if (marksBefore >= CRICKET_TARGET_MARKS) {
      scored = value * multiplier;
      player.runs += scored;
    }

    //calculate new marks and update player data
    const newMarks = marksBefore + multiplier;
    player.marks[value] = Math.min(newMarks, CRICKET_TARGET_MARKS);

    //if we scored more than 3 marks, the extra marks count as points if not all players have closed it
    if (newMarks > CRICKET_TARGET_MARKS) {
      const extraMarks = newMarks - CRICKET_TARGET_MARKS;
      scored = value * extraMarks;
      player.runs += scored;
    }
  }

  //player can only finish if all numbers are closed and they have the most points or are tied for most points
  const allMarked = CRICKET_NUMBERS.every(n => player.marks[n] >= CRICKET_TARGET_MARKS);

  const hasMostPoints = state.players.every(p => p === player || p.runs <= player.runs);
  if (allMarked && hasMostPoints) {
    player.finished = true;
    return { finished: true, scored };
  }
  return { finished: false, scored };
}