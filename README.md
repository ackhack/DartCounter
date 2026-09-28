# 🎯 Dart Counter

A fast, offline-friendly web app for scoring darts games. Built with plain HTML, CSS, and vanilla JavaScript — no frameworks, no build step. Installable as a PWA and works offline.

## Features

- **Two game modes**
  - **X01** — 301 / 501 / 701, count down to zero with bust and checkout handling
  - **Cricket** — close 15–20 + bull, then rack up points
- **2 to many players** — add or remove players freely, with name autocomplete from previous games
- **One-tap scoring** — tap a number or special button and the dart scores instantly; no submit button
  - Single / Double / Triple multipliers, Bull, BullsEye, and Miss
  - Quick-turn presets (e.g. `T20 20 20`) for common X01 turns
- **Undo** — take back the last dart, even across turn boundaries
- **Live game view** — active player, throw slots, player queue, cricket marks board, and turn history
- **Resume after reload** — in-progress games are saved and restored automatically
- **Player stats** — per-player, per-mode aggregates (averages, best turn, checkout %, bull darts, win rate) plus recent game results
- **Offline & installable** — service worker caches the whole app; add to home screen on mobile or desktop

## Game Modes

### X01

Start from 301, 501, or 701 and throw darts to count down to exactly zero.

- **Bust** — if your score goes below zero, the turn reverts to its starting score and the remaining darts count as misses.
- **Checkout** — landing on exactly zero finishes you.
- The game ends when all but one player have finished; remaining players are ranked by finish order.

### Cricket

Close the numbers **15, 16, 17, 18, 19, 20, and bull (B)** by hitting each three times.

- Once a number is closed, further hits on it score points (value × multiplier).
- A player finishes when all numbers are closed **and** they have the most points (ties finish together).
- The keypad only shows 15–20 + bull in this mode.

## Running Locally

The app is a static site, but it must be served over HTTP (not opened via `file://`) so the service worker can register. From the project root:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

or

```bash
npx serve .
# then open http://localhost:3000
```

## Installing as a PWA

When the app is served over HTTP(S), the browser will offer to **install** it (or "Add to Home Screen" on mobile). Once installed, it launches as a standalone app and keeps working offline — all game data is stored in the browser's local storage on the device.

## Project Structure

```
├── index.html            # Single page: setup / stats / game screens + results modal
├── manifest.json         # PWA manifest
├── service-worker.js     # Offline caching (cache-first, versioned)
├── css/
│   ├── base.css          # Shared styles, reset, buttons
│   ├── setup.css         # Setup screen
│   ├── game.css          # Game screen
│   ├── modal.css         # Game-over modal
│   └── stats.css         # Stats screen
└── js/
    ├── constants.js      # Storage keys & game constants
    ├── storage.js        # localStorage persistence & stats
    ├── state.js          # Game state & DOM references
    ├── setup.js          # Event listeners & setup screen
    ├── game-flow.js      # Start / replay / reset flow
    ├── input.js          # Dart input & quick-turn presets
    ├── undo.js           # Undo logic
    ├── scoring.js        # X01 & Cricket scoring rules
    ├── render.js         # Game screen rendering
    ├── stats-screen.js   # Stats screen rendering
    ├── end-game.js       # Results & game-over modal
    └── main.js           # Initialization & service-worker registration
```
