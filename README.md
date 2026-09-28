# 🎯 Dart Counter

A fast, share-the-screen dart scoreboard. Built as a static web app — no build step, no dependencies. Big tap-friendly UI, dark theme, works in any modern browser (great on tablets in the dart pub).

## Features

- **X01** (301 / 501 / 701) — instant scoring: tap a number and the dart is in. Bust detection reverts the turn.
- **Cricket** — 15–20 + bull, 3 marks to close, points from the 4th hit, simultaneous finishes handled.
- **Shanghai (21)** — 1 → 20 → bull; only the current number scores (single/double/triple = 1×/2×/3×), single + double + triple in one turn wins instantly, and after the bull the most points takes it.
- **2–8+ players** — names persisted for quick re-selection, each player gets a stable, distinct color.
- **Quick turns** — one-tap presets (`T20 20 20`, `MISS MISS MISS`, common 20-20 combos).
- **Undo** — per-dart, including busts and cricket marks.
- **Per-player stats** — games, wins, 3-dart averages (per turn/per game), best turn, checkout %, bull darts, win rate — tracked **separately for X01, Cricket and Shanghai**, plus the last 50 games.
- **Replay** — one tap to re-run the game with the previous winner starting last.
- **DartIt auto-scoring** (optional) — a Chrome extension forwards every dart detected on [dartit.net](https://dartit.net) straight into the scoreboard.

## Run it

No build. Serve the folder with any static file server:

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080/>. (Opening `index.html` directly also works for basic play.)

## DartIt Bridge (optional auto-scoring)

The included Chrome extension captures dartit.net's camera detections and auto-enters each dart.

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select the `plugin/dartit-bridge/` folder.
3. Serve DartCounter from `http://localhost/...` (or `http://192.168.178.92/...` — the dev LAN IP in the manifest; add your host to `host_permissions` in `plugin/dartit-bridge/manifest.json` if different).
4. Keep a DartCounter tab open on the game screen. On a dartit.net tab, throw a dart — it appears in the scoreboard automatically.

Only recognized throws are scored (numbers 1–20 with single/double/triple, bull, bullseye, miss); anything unrecognised is ignored rather than guessed.

## Usage

1. **Setup screen** — pick mode, starting score (X01), number of players, enter names, **Start Game**.
2. **Game screen** — tap a number to score a dart; use **Double/Triple** before a number for 2×/3×; **Bull** / **BullsEye** / **MISS** for specials. **Undo** reverts the last dart; **Next** misses out the rest of the turn. **End** ends the game early.
3. **Game over** — results, game stats, **Play Again** (replay) or **Back to Setup**.
4. **Player Stats** — from the setup screen; per-mode aggregates and recent games.

## Project structure

```
index.html            Single page: setup / game / stats screens + end modal
css/                  base, setup, game, modal, stats styles
js/
  constants.js        Storage keys, colors, game constants
  storage.js          localStorage, stats schema + migration
  state.js            Global state, input, DOM helpers
  setup.js            Setup screen logic
  game-flow.js        Start / replay / init / navigation
  input.js            On-screen input, throw tokens, presets
  undo.js             Per-dart undo
  scoring.js          X01 & cricket scoring, busts, finishes
  render.js           Game screen rendering
  stats-screen.js     Stats screen
  end-game.js         Results, stats update
  dartit-bridge.js    App side of the DartIt bridge
  main.js             init()
plugin/dartit-bridge/ Chrome extension (MV3) for dartit.net auto-scoring
```

Plain scripts with shared globals, loaded in dependency order by `index.html` — no modules, no bundler.
