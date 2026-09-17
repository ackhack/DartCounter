# QWEN.md — Dart Counter

## Project Overview

Dart Counter is a mobile-first **Progressive Web App (PWA)** for tracking darts scores. It is a pure static web app — **vanilla HTML/CSS/JS with zero dependencies, no framework, no build step, and no package.json**.

Supported game modes:

- **X01** — count down from 301, 501, or 701 to exactly zero (bust = overshoot below zero; the turn reverts **and ends immediately** — the remaining darts auto-count as misses and play passes to the next player)
- **Cricket** — close the 15–20 and Bull (3 marks each); points score on the 4th mark onward, but only while not every player has closed that target

The app supports any number of named players (minimum 2, no upper limit), instant per-dart scoring, undo, a player stats screen with per-mode lifetime stats and averages (persisted in localStorage), and offline use via a service worker.

## File Structure

| File | Purpose |
|------|---------|
| `index.html` | Three screens (`#setup-screen`, `#game-screen`, `#stats-screen`) plus an end-game modal. All interactive elements use `data-*` attributes (`data-mode`, `data-score`, `data-count`, `data-num`, `data-mult`, `data-special`) read by `main.js`. Player name rows are rendered dynamically by `main.js` — each has a ✕ remove button, and `#add-player-btn` grows the list. |
| `main.js` | Entire app logic in a single IIFE with `'use strict'`. Sections: constants → state → localStorage → event listeners → game flow → input handling → undo → scoring → rendering → stats screen → end game. |
| `styles.css` | Dark theme built on CSS custom properties in `:root` (`--bg-*`, `--accent`, etc.). Organized by banner comments per screen/component. Mobile-first, `100dvh` layout. |
| `manifest.json` | PWA manifest — standalone display, portrait-primary, theme color `#16213e`. |
| `service-worker.js` | Cache-first strategy (`CACHE_NAME = 'dartcounter-v6'`), network fallback, offline navigation fallback to `/index.html`. |
| `icon-192.png`, `icon-512.png`, `icon-512.svg` | PWA icons. |
| `test/dartcounter-test.js` | Node E2E harness (stub DOM + in-memory localStorage, loads the real `main.js`, plays full games by clicking stub buttons). |

## Building and Running

No build step exists. The app is static files:

```bash
# Any static server works, e.g.:
python3 -m http.server 8080
# then open http://localhost:8080
```

Notes:
- The service worker only registers over `http(s)` or `localhost` (see `tryRegisterSW()` in `main.js`); opening `index.html` via `file://` skips it silently.
- There is **no linter and no CI**. The only tests are a Node E2E harness at `test/dartcounter-test.js` (stub DOM + in-memory localStorage, loads the real `main.js`, plays full games by clicking stub buttons): run `node --check main.js && node test/dartcounter-test.js`.
- **Bump `CACHE_NAME` in `service-worker.js`** when changing cached assets so clients pick up the new version on activate.

## Architecture & Key Conventions

### State model
- A single `state` object holds mode, players, current turn, round, and history; `input` holds the transient button selection.
- `state._currentPlayerTurn` is a transient in-progress 3-dart turn (under-scores it with `_`). It is persisted to localStorage along with the rest of state.
- **Undo invariant:** when undoing a *completed* turn, `_currentPlayerTurn` holds **direct references** to the history entry's `throws`/`values`/`_scoring` arrays (not copies) so that in-progress undo and history undo mutate the same arrays. Do not "fix" this to `slice()` — it reintroduces a bug where extra undos were allowed.

### Scoring rules (implemented in `processX01Score` / `processCricketScore`)
- **X01:** `score < 0` is a bust — score, runs, and turns are all reverted; the throw is recorded as `"LABEL (BUST)"` and excluded from turn totals. A bust **ends the turn immediately**: the remaining darts are auto-filled as `MISS` throws (each still increments `player.turns`, the per-dart counter, so undoing them stays balanced) and play passes to the next player. `score === 0` finishes the player and ends their turn early.
- **Cricket:** marks cap at `CRICKET_TARGET_MARKS` (3). A dart only adds to `runs` if it hits an already-closed target while at least one other player hasn't closed it (tracked via the per-throw `_scoring` boolean array). Closing all targets finishes the player.
- Turn total for X01 excludes busted values; for Cricket it sums only throws where `_scoring[i]` is true.

### Input / instant scoring
- Pressing a **number** button scores a dart immediately using the currently active multiplier (default 1), then resets the multiplier to 1. Pressing a **multiplier** after a number re-scores with that multiplier (see `selectMultiplier` / `selectSpecial`).
- Special buttons: Bull (25), Bullseye (50), MISS (0).
- One undo (`#undo-btn`) reverts the last single dart, whether the turn is in progress or already in history.
- **Stale-selection invariant:** a game-winning dart takes the `endGame(); return;` path in `submitScore`, which skips the final `clearInput()` — so `input` still holds the winning number with `selected: true`. `startGame()` and `replayGame()` therefore call `clearInput()`; without it, the first multiplier click of the next game instant-scores a phantom dart from the stale selection.

### Persistence (localStorage)
- `dartcounter_game` — full in-progress game state, saved after every dart; restored on load only if `gameStarted && !gameOver`.
- `dartcounter_stats` — per-player lifetime stats keyed by lowercased name, each with a `modes` object holding separate `x01` and `cricket` records (games, wins, runs, turns, darts, best turn/finish, checkout attempts/made, bull darts, plus stored averages: `avgPerTurn`, `avgPerGame`, `winRate`, `checkoutPct`), + last 50 game records (rendered as the Recent Games list on the stats screen). Legacy flat entries are migrated on load (attributed to X01; old `totalTurns` counted darts, so it maps to `totalDarts`; corrupt legacy `bestTurn` values are dropped).
- `dartcounter_player_names` — up to 20 remembered names, offered via `<datalist id="player-name-suggestions">`. Generated defaults (`Player 1`, …) are never saved.

### Per-player stats (`updatePlayerStats`, called once per player in `endGame`)
- True turns are counted from `state.history` entries per player — note `player.turns` is a per-*dart* counter despite its name.
- Checkout stats are derived by walking the player's history backwards from their final score (`computeX01CheckoutStats`): a turn that started from ≤ `MAX_X01_TURN` (180 — 3×T20, the max a 3-dart turn can finish from) was an opportunity; the player's last history entry is the finishing turn. Deriving from history (not live counters) keeps undo from skewing stats; `countBullDarts` works the same way from throw labels.
- `bestTurn` is the max single-turn score from the player's history (never the game-total runs); legacy/repair passes on load drop or reset stored X01 values above `MAX_X01_TURN`, which are provably corrupt from the old bug.
- The stats screen (`renderStatsScreen`) lists players with a per-mode card each; empty modes are hidden. Each player card has a ✕ reset button (confirms, deletes that player's stats entry). Below the list, `renderRecentGames` shows the last 50 saved games (date, mode + start, winner, final scores) from `stats.games`.

### Coding conventions
- 2-space indentation, single quotes in JS, arrow functions, `const` for all configuration values (see the CONSTANTS block: `CRICKET_NUMBERS`, `CRICKET_TARGET_MARKS`, `X01_OPTIONS`, `MIN_PLAYERS`, `SCORES_PER_TURN`, etc.). **Extract new magic numbers into named constants in this block rather than hardcoding them.**
- Section banner comments (`// ====` …) organize both `main.js` and `styles.css`.
- DOM helpers `$` / `$$` (querySelector / querySelectorAll) are defined once at the top.
- Rendering is imperative DOM manipulation via innerHTML templates in `renderGame()` / `renderQueue()` / `renderHistory()`; history list does incremental DOM updates (prepend/rebuild/in-place) to avoid animation flicker.
- CSS theming goes through `:root` custom properties — add new colors/shadows/radii there, not inline.

## Gotchas

- The player-count buttons (2–8) are only quick shortcuts — the real roster is whatever rows exist in `#name-inputs`. The `+ Add Player` button grows the list past 8 (no count button is active then); the per-row ✕ buttons shrink it down to `MIN_PLAYERS` (2), at which point they disable. Removing a row renumbers the rest and preserves the other names (rows are removed from the DOM, not re-rendered).
- `backToSetup()` hides the end modal — without that, the game-over modal lingers over the setup screen.
- The game-over check runs right after a turn completes (`finishedCount >= players.length - 1`) and calls `endGame()`, which clears the persisted game state — undo is disabled once `state.gameOver` is true.
- The header **End** button is the manual finish path — it asks for confirmation before finalizing (destructive: it writes stats for an unfinished game). The automatic game-over path in `submitScore` stays unguarded because it is the real finish.
- `startGame()` rejects duplicate player names (case-insensitive, via `alert`) and aborts — name-keyed aggregates (stats entries, the modal's per-name best-turn map) would collide.
- `replayGame()` re-seats players worst-first (loser throws first) using the same settings; the end modal offers Play Again / New Game / Back to Setup.
- Cricket mark rows use ids `#marks-15` … `#marks-20` and `#marks-bull`; the bull row's label is rendered as `B`.
