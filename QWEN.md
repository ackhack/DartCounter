# QWEN.md — Dart Counter

## Project Overview

Dart Counter is a mobile-first **Progressive Web App (PWA)** for tracking darts scores. It is a pure static web app — **vanilla HTML/CSS/JS with zero dependencies, no framework, no build step, and no package.json**.

Supported game modes:

- **X01** — count down from 301, 501, or 701 to exactly zero (bust = overshoot below zero, turn reverts)
- **Cricket** — close the 15–20 and Bull (3 marks each); points score on the 4th mark onward, but only while not every player has closed that target

The app supports 2–8 named players, instant per-dart scoring, undo, a player stats screen with per-mode lifetime stats and averages (persisted in localStorage), and offline use via a service worker.

## File Structure

| File | Purpose |
|------|---------|
| `index.html` | Three screens (`#setup-screen`, `#game-screen`, `#stats-screen`) plus an end-game modal. All interactive elements use `data-*` attributes (`data-mode`, `data-score`, `data-count`, `data-num`, `data-mult`, `data-special`) read by `main.js`. |
| `main.js` | Entire app logic in a single IIFE with `'use strict'`. Sections: constants → state → localStorage → event listeners → game flow → input handling → undo → scoring → rendering → stats screen → end game. |
| `styles.css` | Dark theme built on CSS custom properties in `:root` (`--bg-*`, `--accent`, etc.). Organized by banner comments per screen/component. Mobile-first, `100dvh` layout. |
| `manifest.json` | PWA manifest — standalone display, portrait-primary, theme color `#16213e`. |
| `service-worker.js` | Cache-first strategy (`CACHE_NAME = 'dartcounter-v3'`), network fallback, offline navigation fallback to `/index.html`. |
| `icon-192.png`, `icon-512.png`, `icon-512.svg` | PWA icons. |

## Building and Running

No build step exists. The app is static files:

```bash
# Any static server works, e.g.:
python3 -m http.server 8080
# then open http://localhost:8080
```

Notes:
- The service worker only registers over `http(s)` or `localhost` (see `tryRegisterSW()` in `main.js`); opening `index.html` via `file://` skips it silently.
- There are **no tests, no linter, and no CI** configured.
- **Bump `CACHE_NAME` in `service-worker.js`** when changing cached assets so clients pick up the new version on activate.

## Architecture & Key Conventions

### State model
- A single `state` object holds mode, players, current turn, round, and history; `input` holds the transient button selection.
- `state._currentPlayerTurn` is a transient in-progress 3-dart turn (under-scores it with `_`). It is persisted to localStorage along with the rest of state.
- **Undo invariant:** when undoing a *completed* turn, `_currentPlayerTurn` holds **direct references** to the history entry's `throws`/`values`/`_scoring` arrays (not copies) so that in-progress undo and history undo mutate the same arrays. Do not "fix" this to `slice()` — it reintroduces a bug where extra undos were allowed.

### Scoring rules (implemented in `processX01Score` / `processCricketScore`)
- **X01:** `score < 0` is a bust — score, runs, and turns are all reverted; the throw is recorded as `"LABEL (BUST)"` and excluded from turn totals. `score === 0` finishes the player and ends their turn early.
- **Cricket:** marks cap at `CRICKET_TARGET_MARKS` (3). A dart only adds to `runs` if it hits an already-closed target while at least one other player hasn't closed it (tracked via the per-throw `_scoring` boolean array). Closing all targets finishes the player.
- Turn total for X01 excludes busted values; for Cricket it sums only throws where `_scoring[i]` is true.

### Input / instant scoring
- Pressing a **number** button scores a dart immediately using the currently active multiplier (default 1), then resets the multiplier to 1. Pressing a **multiplier** after a number re-scores with that multiplier (see `selectMultiplier` / `selectSpecial`).
- Special buttons: Bull (25), Bullseye (50), MISS (0).
- One undo (`#undo-btn`) reverts the last single dart, whether the turn is in progress or already in history.

### Persistence (localStorage)
- `dartcounter_game` — full in-progress game state, saved after every dart; restored on load only if `gameStarted && !gameOver`.
- `dartcounter_stats` — per-player lifetime stats keyed by lowercased name, each with a `modes` object holding separate `x01` and `cricket` records (games, wins, runs, turns, darts, best turn/finish, checkout attempts/made, bull darts, plus stored averages: `avgPerTurn`, `avgPerGame`, `winRate`, `checkoutPct`), + last 50 game records. Legacy flat entries are migrated on load (attributed to X01; old `totalTurns` counted darts, so it maps to `totalDarts`).
- `dartcounter_player_names` — up to 20 remembered names, offered via `<datalist id="player-name-suggestions">`. Generated defaults (`Player 1`, …) are never saved.

### Per-player stats (`updatePlayerStats`, called once per player in `endGame`)
- True turns are counted from `state.history` entries per player — note `player.turns` is a per-*dart* counter despite its name.
- Checkout stats are derived by walking the player's history backwards from their final score (`computeX01CheckoutStats`): a turn that started from ≤ `MAX_TURN_VALUE` (60) was an opportunity; the player's last history entry is the finishing turn. Deriving from history (not live counters) keeps undo from skewing stats; `countBullDarts` works the same way from throw labels.
- The stats screen (`renderStatsScreen`) lists players with a per-mode card each; empty modes are hidden.

### Coding conventions
- 2-space indentation, single quotes in JS, arrow functions, `const` for all configuration values (see the CONSTANTS block: `CRICKET_NUMBERS`, `CRICKET_TARGET_MARKS`, `X01_OPTIONS`, `MAX_PLAYERS`, `SCORES_PER_TURN`, etc.). **Extract new magic numbers into named constants in this block rather than hardcoding them.**
- Section banner comments (`// ====` …) organize both `main.js` and `styles.css`.
- DOM helpers `$` / `$$` (querySelector / querySelectorAll) are defined once at the top.
- Rendering is imperative DOM manipulation via innerHTML templates in `renderGame()` / `renderQueue()` / `renderHistory()`; history list does incremental DOM updates (prepend/rebuild/in-place) to avoid animation flicker.
- CSS theming goes through `:root` custom properties — add new colors/shadows/radii there, not inline.

## Gotchas

- The game-over check runs right after a turn completes (`finishedCount >= players.length - 1`) and calls `endGame()`, which clears the persisted game state — undo is disabled once `state.gameOver` is true.
- `replayGame()` re-seats players worst-first (loser throws first) using the same settings; the end modal offers Play Again / New Game / Back to Setup.
- Cricket mark rows use ids `#marks-15` … `#marks-20` and `#marks-bull`; the bull row's label is rendered as `B`.
- `updateInputPreview()` references a `#input-preview` element that no longer exists in the HTML — the function no-ops safely; it is dead code.
