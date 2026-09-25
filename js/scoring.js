// ===========================
// DART COUNTER - Scoring
// ===========================
'use strict';

function submitScore(forcedMult) {
  let mult = forcedMult !== undefined ? forcedMult : input.multiplier;
  if (state.gameOver) return;
  const player = state.players[state.currentPlayerIndex];
  if (player.finished) return;//idk why we would hit this

  //#region Scoring
  let throwValue = 0;
  let throwLabel = '';

  if (input.special === '0') {
    throwValue = 0;
    throwLabel = 'Miss';
  } else if (input.special === 'bull') {
    throwValue = 25;
    mult = 1;
    throwLabel = 'Bull';
  } else if (input.special === 'bulleye') {
    throwValue = 25;
    mult = 2;
    throwLabel = 'BE';
  } else if (input.number !== null) {
    throwValue = input.number;
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

  // Clear input for next throw
  clearInput();

  console.log(throwValue);
  console.log(mult);
  console.log(throwLabel);

  //update counts
  player.turns++;
  state.throwCount++;

  // If first throw of turn, initialize the turn object
  if (!state._currentPlayerTurn) {
    console.log("new _currentPlayerTurn")
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
  let cricketResult = isCricket() ? null : undefined;
  if (isX01()) {
    bust = processX01Score(player, throwValue * mult);
  } else if (isCricket()) {
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
    if (isCricket() && cricketResult) {
      state._currentPlayerTurn._scoring[state.throwCount - 1] = cricketResult.scored;
      console.log("" + state.throwCount + " " + cricketResult.scored)
    } else {
      state._currentPlayerTurn._scoring[state.throwCount - 1] = 0;
    }

    // If player finished mid-turn, end the turn immediately
    if (cricketResult?.finished || (isX01() && player.finished)) {
      state.throwCount = SCORES_PER_TURN;
    }
  }
  //#endregion

  //render new game state
  renderGame();

  // Check if turn is not complete (3 scores)
  if (state.throwCount < SCORES_PER_TURN) {
    // Go to next throw and render
    return;
  }

  //#region History Entry

  // Calculate turn total based on mode
  let turnTotal;
  if (isX01()) {
    if (!state._currentPlayerTurn.throws.every(t => !t.includes('BUST'))) {
      //if busted total is 0
      turnTotal = 0;
    } else {
      // For X01, total excludes busted values
      turnTotal = state._currentPlayerTurn.values.reduce((sum, val, _) => sum + val[2], 0);
    }
  } else {
    // Cricket: only count points from darts that hit a scoring number
    turnTotal = state._currentPlayerTurn.values.reduce((sum, val, i) => {
      if (state._currentPlayerTurn._scoring && state._currentPlayerTurn._scoring[i] > 0) return sum + state._currentPlayerTurn._scoring[i];
      return sum;
    }, 0);
  }

  // Update history, reset current turn
  state._currentPlayerTurn.total = turnTotal;
  state.history.push(state._currentPlayerTurn);
  //#endregion

  state._currentPlayerTurn = null;

  // Move to next player
  let nextIdx = (state.currentPlayerIndex + 1) % state.players.length;
  let safety = 0;
  while (state.players[nextIdx].finished && safety < state.players.length) {
    nextIdx = (nextIdx + 1) % state.players.length;
    safety++;
  }
  state.currentPlayerIndex = nextIdx;

  //In Cricket if all players have closed, the game is practically over, we handle this here
  if (isCricket() && CRICKET_NUMBERS.every(n => cricketAllPlayersClosed(n))) {
    const thisCount = state.throwCount;
    setTimeout(() => {
      if (thisCount == state.throwCount) {
        cricketMultiplePlayerFinish();
        endGame();
      }
    }, 3000);
    return;
  }

  // Check game over: all but one finished
  let playersFinished = 0;
  state.players.forEach(p => {
    if (p.finished) playersFinished++;
  });
  if (playersFinished + 1 >= state.players.length) {
    const thisCount = state.throwCount;
    setTimeout(() => {
      if (thisCount == state.throwCount) {
        endGame();
      }
    }, 3000);
    return;
  }

  // Reset for next player's turn
  state.throwCount = 0;
  state.round++;
  //show last dart for 3 secs, then render next player
  setTimeout(() => {
    //only render new state if nothing change, if something changed, renderGame will be called there
    if (state.throwCount == 0) {
      renderGame();
    }
  }, 3000);
}

function processX01Score(player, value) {
  console.log("X01 updating score")
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
    // Count of players still in the game (incl. this one). endGame() sorts
    // descending, so the first finisher gets the highest value and the last
    // remaining player (never set, stays 0) ranks last.
    player.currentGamePosition = state.players.filter(p => !p.finished).length;
    player.finished = true;
  }

  return false;
}

function processCricketScore(player, value, multiplier) {
  let scored = 0;

  // no reason to process anything below 15
  if (value < 15) return { finished: false, scored };

  //only do scoring if not all players have closed the number
  if (!cricketAllPlayersClosed(value)) {

    // Score when hitting an already-closed target (4th hit onward) AND not all players have closed it
    const marksBefore = player.marks[value] || 0;
    if (marksBefore >= CRICKET_TARGET_MARKS) {
      scored = value * multiplier;
      player.runs += scored;
    } else {
      //calculate new marks and update player data
      const newMarks = marksBefore + multiplier;
      player.marks[value] = Math.min(newMarks, CRICKET_TARGET_MARKS);

      //if we scored more than 3 marks, the extra marks count as points if not all players have closed it
      if (newMarks > CRICKET_TARGET_MARKS && !cricketAllPlayersClosed(value)) {
        const extraMarks = newMarks - CRICKET_TARGET_MARKS;
        scored = value * extraMarks;
        player.runs += scored;
      }
    }
  }

  if (cricketPlayerFinished(player)) {
    player.finished = true;
    player.currentGamePosition = state.players.filter(p => !p.finished).length;
    cricketMultiplePlayerFinish();
    return { finished: true, scored };
  }
  return { finished: false, scored };
}

function cricketPlayerFinished(player) {
  //player can only finish if all numbers are closed and they have the most points or are tied for most points
  const allMarked = CRICKET_NUMBERS.every(n => player.marks[n] >= CRICKET_TARGET_MARKS);
  const hasMostPoints = state.players.every(p => p === player || p.finished || p.runs <= player.runs);
  return allMarked && hasMostPoints;
}

function cricketMultiplePlayerFinish() {
  let anyFinished;
  do {
    anyFinished = false;
    //get every player that is not finished but can finish and finish them
    state.players.forEach(p => {
      if (!p.finished && cricketPlayerFinished(p)) {
        p.finished = true;
        anyFinished = true;
        p.currentGamePosition = state.players.filter(p => !p.finished).length;
      }
    });
  } while (anyFinished);
}