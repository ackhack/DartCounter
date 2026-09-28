# QWEN.md — Dart Counter

Instructional context for working on this codebase.

## Project Overview

**Dart Counter** is an installable Progressive Web App (PWA) for scoring darts games. It supports two game modes — **X01** (301/501/701, count-down to zero) and **Cricket** (close 15–20 + bull, then rack up points) — for 2 to many players. It tracks per-player, per-mode statistics and recent game history, and lets you resume an in-progress game after a reload.

It is a **pure static site**: plain HTML + CSS + vanilla JavaScript. There is **no framework, no build step, no bundler, and no package manager / dependency list**. Everything runs directly in the browser, and offline capability comes from a service worker that caches all assets.

## Tech Stack

- **HTML/CSS** — single `index.html` with three full-page "screens" (setup, stats, game) shown/hidden via a `.active` class, plus a game-over modal.
- **Vanilla JS (ES2020+)** — no modules/`import`; all files share one global namespace. `'use strict'` at the top of every JS file.
- **Service Worker + Web App Manifest** — offline PWA (cache-first strategy).
- **localStorage** — persistence for player names, stats, and in-progress game state.

## Running the App

There is no build. It must be **served over HTTP(S)** — do not open `index.html` via `file://`, because the service worker is registered against absolute paths (`/index.html`, `/js/...`) and only works on a proper origin (localhost qualifies).

From the project root, any static server works, e.g.:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```
or
```bash
npx serve .
# then open http://localhost:3000
```

> **No tests, linter, or type-checker are configured.** There is no `package.json`, no test runner, no CI. Verify changes by loading the app in a browser and playing a game.

### Service-worker caching gotcha

`service-worker.js` uses a versioned cache (`dartcounter-v13`) that caches every listed asset on `install`. After editing an asset, **bump `CACHE_NAME`** (and keep the `ASSETS` array in sync with any added/renamed files) so the new version is activated; otherwise a hard refresh is needed to clear the stale cache.

## Project Structure

```
DartCounter/
├── index.html            # Single page: setup / stats / game screens + end-game modal. Defines JS load order (bottom).
├── manifest.json         # PWA manifest (name, icons, standalone, portrait).
├── service-worker.js     # Offline cache (cache-first), versioned cache name.
├── icon-192.png, icon-512.png, icon-512.svg   # PWA / favicon icons.
├── css/
│   ├── base.css          # Reset, layout primitives, shared components (buttons, screens).
│   ├── setup.css         # Setup screen.
│   ├── game.css          # Game screen (score panel, input panel, cricket marks, queue, history).
│   ├── modal.css         # Game-over modal.
│   └── stats.css         # Stats screen.
└── js/                   # One file per concern. Load order in index.html matters (see below).
    ├── constants.js      # Storage keys, game constants, isX01()/isCricket() helpers.
    ├── storage.js        # localStorage load/save; stats model; legacy data migration.
    ├── state.js          # Global `state`, `input`, `stats`, DOM refs, $/$$ helpers, `screens`.
    ├── setup.js          # Event-listener wiring; setup screen; player name rows.
    ├── game-flow.js      # startFirstGame / replayGame / initGame / backToSetup / showScreen.
    ├── input.js          # Number/multiplier/special selection; instant scoring; presets; skip.
    ├── undo.js           # undoLast() — revert the most recent dart.
    ├── scoring.js        # submitScore() (core turn logic) + X01 & Cricket scoring.
    ├── render.js         # renderGame() — active player, throws, cricket marks, queue, history.
    ├── stats-screen.js   # Renders the Player Stats screen from `stats`.
    ├── end-game.js       # endGame() + results modal.
    └── main.js           # init() — wire listeners, seed UI, register service worker.
```

### JS load order (bottom of `index.html`)

Files share globals and depend on each other, so order is load-bearing. `constants.js` → `storage.js` → `state.js` (defines `state`/`input`/`$`/`$$`/`screens`) must come first; `main.js` (which calls `init()`) is last. When adding a new script, insert it **before** `main.js` and after any file it depends on, and **add its path to the `ASSETS` array** in `service-worker.js`.

## Architecture & Data Flow

- **Single global `state` object** (`state.js`) is the source of truth for a game: `mode`, `x01Start`, `players[]`, `currentPlayerIndex`, `throwCount`, `round`, `history[]`, `gameStarted`, `gameOver`, and a transient `_currentPlayerTurn` (the in-progress 3-dart turn before it's committed to `history`).
- **State-driven rendering**: the pattern is *mutate `state`, then `saveGameState()` + `renderGame()`*. There is no reactive framework; `render.js` rebuilds the relevant DOM from `state` on each call.
- **Instant scoring**: pressing a number or a special button immediately submits that dart (there is no "submit" button). `selectNumber()` / `selectSpecial()` in `input.js` call `submitScore()`.
- **`submitScore()`** (`scoring.js`) is the heart of the game: it resolves the dart value, applies mode-specific scoring, tracks the in-progress turn, handles busts/finishes, commits the turn to `history`, advances the current player, and detects game over.
- **Undo** (`undo.js`) does **not** keep a snapshot stack. It pops the last throw from `_currentPlayerTurn` (or the last committed `history` entry) and manually reverts the affected player's `score`/`runs`/`marks`. Because of this, `storage.js` derives checkout stats *from history* so undo can't skew them.

### Global helpers (defined once, used everywhere)

- `$` / `$$` — `document.querySelector` / `querySelectorAll` shorthands (`state.js`).
- `isX01()` / `isCricket()` — mode checks (`constants.js`).
- `screens` — map of the three screen elements for `showScreen()`.

## Game Modes & Rules

- **X01**: start at 301/501/701; subtract dart values; **bust** = score goes below 0 (turn reverts to its starting score, remaining darts count as misses); **finish** = exactly 0. Game ends when all but one player have finished (or one player finishes last). Multipliers: Single/Double/Triple; Bull = 25, BullsEye (inner) = 50.
- **Cricket**: close numbers 15–20 and bull (25) by hitting each **3 times** (`CRICKET_TARGET_MARKS`). After a number is closed, further hits score points (value × multiplier, capped so the number can't be over-closed). A player finishes when all numbers are closed **and** they have the most (or tied-most) points; `cricketMultiplePlayerFinish()` finishes any co-leading players together.
- **Quick-turn presets** (X01 only) let you enter a full 3-dart turn in one tap (e.g. `T20 20 20`); each dart is still individually undoable.

## Persistence (localStorage)

Keys (see `constants.js`):

| Key | Content |
|---|---|
| `dartcounter_player_names` | Array of previously used player names (for autocomplete), capped at 20. |
| `dartcounter_stats` | `{ players: { <lowercaseName>: { name, modes: { x01, cricket } } }, games: [...] }`. Per-mode aggregates (games, wins, runs, darts, best turn, checkout %, bull darts, averages). Recent games capped at 50. |
| `dartcounter_game` | Serialized in-progress `state`. On load, `loadGameState()` restores it **only** if `gameStarted && !gameOver`, so a reload resumes the game. Cleared on new game / end game / back-to-setup. |

`storage.js` also performs **one-time migrations** of legacy stat shapes (flat per-player entries → per-mode structure) and repairs corrupt `bestTurn` values. Be aware that `saveGameState()` serializes `state` *including* the transient `_currentPlayerTurn`.

## Development Conventions

- **Global-namespace pattern** — no modules. Add new functions as globals in the file that owns that concern; reference existing globals directly. Keep `'use strict'` at the top.
- **File header banner** — each JS file starts with a `// =========================== / // DART COUNTER - <Area> / // ===========================` comment block. Match it for new files.
- **One concern per file** — split by responsibility (scoring vs. rendering vs. persistence), mirroring the CSS split by screen.
- **Extract configuration-like numbers into named constants** in `constants.js` rather than hardcoding them inline (e.g. `CRICKET_TARGET_MARKS`, `SCORES_PER_TURN`, `MAX_X01_TURN`).
- **Mutate-then-render** — after changing `state`, call `saveGameState()` and the relevant `render*()` function.
- **Player names are unique, case-insensitively** — stats and the results modal are keyed by lowercased name; `startFirstGame()` rejects duplicates.

## Gotchas / Things to Know

- `state._currentPlayerTurn` is transient (the in-progress turn) but **is** persisted by `saveGameState()`; `undo.js` and `scoring.js` rely on its exact shape (`throws`, `values`, `_scoring`, `startingScore`, `startingRuns`).
- `player.currentGamePosition` is a temporary ranking used to sort final results (first finisher gets the highest value); it's reset to 0 in `endGame()`.
- Cricket hides numbers 1–14 on the keypad and hides the X01 preset section; the number grid reflows to 3 columns (see `initGame()`).
- There are leftover `console.log` debug statements throughout (e.g. in `scoring.js`, `render.js`, `undo.js`).
- Manual "End" mid-game is destructive (finalizes and saves stats) and is guarded by a `confirm()`; the automatic game-over path is not.
- The "Replay" button starts a new game with the same players but **reordered so the loser throws first / winner throws last**.
