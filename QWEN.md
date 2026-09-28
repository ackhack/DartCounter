# QWEN.md

## Project Overview

DartCounter is a static, dependency-free web app for scoring dart games, designed for shared-screen play (big UI, dark navy theme). It supports three game modes:

- **X01** (301/501/701): countdown to zero; bust (overshoot or landing on 0) reverts to the turn's starting score.
- **Cricket**: hit 3 marks on 15–20 and the bull (25) to close; points from the 4th hit onward; first player to close everything while leading on points wins (ties finish simultaneously).
- **Shanghai (21)**: targets progress 1→20→bull; every player throws one 3-dart turn per target and only the current target scores (single/double/triple = 1×/2×/3× of the number, bull 25, bulls-eye 50). A single + double + triple of the current target in one turn wins instantly; the bull is not winnable — after it, the most points wins (ties share the top position).

There is no build system, no package manager, no module system — plain ES5-style scripts with `'use strict'`, shared globals, loaded in dependency order by `index.html`. A companion Chrome extension (`plugin/dartit-bridge/`) auto-scores darts from the dartit.net camera service.

## Running

No build step. Serve the directory with any static file server and open `index.html`:

```bash
python3 -m http.server 8080    # then http://localhost:8080/
```

- Opening `index.html` directly via `file://` also works, but the DartIt plugin only matches `http://localhost/*` and `http://192.168.178.92/*` (LAN IP of the dev machine), so for the bridge the app must be served over one of those hosts.
- **DartIt bridge**: load `plugin/dartit-bridge/` as an unpacked extension in Chrome (Manifest V3). While the user throws on dartit.net, each detected dart is forwarded to the open DartCounter tab and scored automatically.
- `index.html` links `manifest.json` (PWA), but no such file exists in the repo root — only `plugin/dartit-bridge/manifest.json` does. Treat the missing root manifest as a known loose end, not a working feature.

## Verification

- No tests, linter, or type checker are configured.
- Node.js is available on this machine — use `node --check <file>` for JS syntax validation of edited files.
- No working headless browser exists on this machine (Firefox headless hangs). For visual/UI changes, rely on `node --check`, careful static review, and ask the user to eyeball the app in their already-running browser.

## Architecture

### File map

| File | Role |
|---|---|
| `index.html` | Single page: 3 screens (setup / game / stats) + end-game modal. Script load order at the bottom matters — it IS the dependency graph. |
| `css/base.css` | Theme, shared layout, screen switching (`.screen.active`). |
| `css/setup.css` | Setup screen styling. |
| `css/game.css` | Game screen: active-player card, cricket marks board, player cards, number grid. |
| `css/modal.css` | End-game modal. |
| `css/stats.css` | Stats screen. |
| `js/constants.js` | Storage keys, 16-color `PLAYER_COLORS` palette (ordered most-distinct-first), cricket constants (`CRICKET_NUMBERS`, `BULL_NUMBER = 25`, `CRICKET_TARGET_MARKS = 3`), `SHANGHAI_TARGETS` (1–20 + bull), `SCORES_PER_TURN = 3`, `MAX_X01_TURN = 180`, `isX01()`/`isCricket()`/`isShanghai()`, `currentShanghaiTarget()`. |
| `js/storage.js` | All `localStorage` I/O, stats schema + legacy migration, derived checkout stats, game-history persistence (capped at 50 games). |
| `js/state.js` | Global `state`, `input`, `stats`, `playerColors`, `playerNames`; `$`/`$$` DOM helpers; `screens` map. |
| `js/setup.js` | Setup screen: mode/starting-score/player-count selection, name inputs with saved-name `<datalist>`, event listeners. |
| `js/game-flow.js` | `startFirstGame` (name validation, color assignment, roster build), `replayGame` (reshuffles so last game's winner starts last), `initGame`, `backToSetup`, `showScreen`. |
| `js/input.js` | On-screen input: **instant scoring** — pressing a number scores that dart immediately (pending multiplier is consumed and reset to 1). `applyThrowToken(token)` turns tokens (`T20`, `D20`, `20`, `Bull`, `BE`, `0`) into input state; `submitPresetTurn` and `skipToNextPlayer` reuse the normal scoring path. |
| `js/undo.js` | Per-dart undo: `undoLast` + `revertPlayerStats`, including bust restoration and cricket mark removal. |
| `js/scoring.js` | Core: `submitScore(forcedMult)`, `processX01Score` (bust/finish), `processCricketScore`, `cricketPlayerFinished`, `cricketMultiplePlayerFinish`, `processShanghaiScore` (instant-win combo), `shanghaiFinalRanking`. |
| `js/render.js` | `renderGame` — active-player card, throw slots, cricket mark dots, player cards with last-5-turn history. |
| `js/stats-screen.js` | Stats screen: per-player, per-mode aggregates; recent-games list. |
| `js/end-game.js` | `endGame` — ranks players, updates persistent stats, saves game to history, renders results modal. |
| `js/dartit-bridge.js` | App side of the bridge: `MutationObserver` on `#dartit-bridge-count` triggers `applyDartItUpdate` → `parseDetect` (raw dartit response → throw token) → `applyThrowToken` + `submitScore`. Duplicate values are dropped. |
| `js/main.js` | `init()` — wires event listeners, renders name suggestions/inputs. |

### State model (`js/state.js`)

- `state.players[]` — `{id, name, color, score, runs, turns, marks{}, finished, currentGamePosition, lastGamePosition?}`. Fixed play order; finished players are skipped on turn advance.
- `state.throwCount` (0–2 within a turn) and `state._currentPlayerTurn` — the **transient in-progress turn** (`{round, playerId, name, color, throws[], values[], _scoring[], startingScore, startingRuns, shanghaiIndex, total?}`). `state.history` holds **completed** turns only. Undo moves a turn back from history into `_currentPlayerTurn`.
- **Shanghai**: `state.shanghaiIndex` (0–20 into `SHANGHAI_TARGETS`) and `state.shanghaiTurnsAtNumber` (completed turns at the current target; at `players.length` the target advances). Turn objects store `shanghaiIndex` so undo can restore the target when crossing a number boundary.
- `input` — pending throw: `number`, `multiplier` (1/2/3), `special` (`'bull'`, `'bulleye'`, `'0'`).
- Turn advance is debounced: a 3000 ms `setTimeout` shows the last dart before rendering the next player, guarded by a `throwCount` snapshot so an intervening undo/other action cancels it. Preserve this pattern when touching turn flow.
- Game over (last remaining player, or all cricket numbers closed by everyone) is likewise deferred 3 s behind a snapshot guard.

### Key invariants (do not break)

- **X01**: bust reverts `score`/`runs` to `startingScore`/`startingRuns`, ends the turn, and the remaining darts are pushed as auto-`MISS` entries into the turn's `throws`/`values` so undo stays balanced. Finishing requires the score to land exactly on 0.
- **Cricket**: only 15–20 and 25 are targetable (lower number buttons are hidden, grid reflows). Marks cap at 3; a hit on an already-closed number scores `value × multiplier`; overshoot marks (4th+ on one number) score as points **unless every player has closed that number**. A player finishes when all 7 numbers are closed **and** they lead (or tie) on `runs`; `cricketMultiplePlayerFinish` loops so simultaneous finishers all resolve.
- **Shanghai**: only the current target scores (`value × multiplier`; bull 25 / bulls-eye 50) — all other buttons stay throwable but score 0, and the grid dims non-scoring buttons. The target advances after **every player** has thrown a 3-dart turn at it (tracked by `shanghaiTurnsAtNumber`). A single + double + triple of the current target within one turn ends the game instantly (never on the bull — no triple ring); after the bull round, `shanghaiFinalRanking` ranks by `runs` and ties share positions. Undo of a completed turn restores `shanghaiIndex`/`shanghaiTurnsAtNumber` from the turn object and history; undoing the winning dart un-finishes the player.
- **Names are identity**: stats, colors, and the end-game best-turn map are keyed by `name.toLowerCase()`. `startFirstGame` rejects duplicate names (case-insensitive) for this reason. Don't introduce name-keyed structures without that guarantee.
- **Colors are stable per name** and stored in `localStorage` (`dartcounter_player_colors`); within one game every player gets a distinct palette color, reassigned + persisted on collision.
- **Stats are derived where possible**: checkout attempts/made are recomputed from `state.history` at game end (so undo can't skew them); `bestTurn` is the best single turn (not per-game runs); games history keeps only the last 50.
- **`player.turns` counts darts** (increments per dart, not per turn) — several aggregates (`maxDarts`, avg-per-turn math) depend on this.

### localStorage schema (keys in `js/constants.js`)

- `dartcounter_stats` — `{ players: { [name.toLowerCase()]: { name, modes: { x01: {...}, cricket: {...}, shanghai: {...} } } }, games: [...] }`. Per-mode stat fields are defined by `emptyModeStats()` (`js/storage.js`). `loadStats()` runs a one-time migration of legacy flat entries into the per-mode shape and resets corrupt `bestTurn` values (> `MAX_X01_TURN`); `updatePlayerStats` lazily backfills `modes.shanghai` on entries created before the mode existed. Keep migrations idempotent and tolerant of corrupt JSON (return fresh defaults).
- `dartcounter_player_names` — saved name suggestions (≤ 20, generated `Player N` defaults excluded).
- `dartcounter_player_colors` — `{ [name.toLowerCase()]: hexColor }`.

## DartIt Bridge (Chrome extension)

Flow: `injected.js` (MAIN world on dartit.net, wraps `fetch`/`XHR` to capture non-GET responses from `vis.dartit.net/detect`) → `window.postMessage` → `dartit-content.js` (isolated world) → `background.js` → `dartcounter-content.js` (on the local DartCounter tab) → writes JSON into `#dartit-bridge-value` and increments `#dartit-bridge-count` → the app's `MutationObserver` (`js/dartit-bridge.js`) scores the throw.

- `parseDetect` maps a raw detect response (`{fields, numbers}`) to a token: explicit bull/miss field markers win; `numbers: 25` falls back to `Bull` (or `BE` when `fields === 'D'`); anything unrecognised returns `null` and is **not** scored — keep that fail-safe.
- `injected.js` must never throw into the host page (all callbacks swallow errors); only non-empty plain-object responses are forwarded.
- `manifest.json` `host_permissions` pin `localhost` and the dev LAN IP `192.168.178.92`; extend the list if the app is served from another host.

## Conventions

- Every `js/*.js` file opens with a `// ===...\n// DART COUNTER - <Area>\n// ===` banner and `'use strict'`; keep the banner when adding files.
- No ES modules, no imports — new shared code goes in the appropriate existing file or a new global-scope script added to `index.html` in dependency order (after `constants.js`/`storage.js`/`state.js`, before `main.js`).
- CSS is split per screen; put game-screen styles in `game.css`, etc.
- Debug `console.log` calls are left in throughout the codebase (author style) — don't strip them as a matter of course, but don't add new ones gratuitously either.
- `alert()` is used for user-facing errors (e.g., duplicate names); modals are used for game-over only.
- Git repo with short imperative commit messages (`ui fixes`, `color order`).
