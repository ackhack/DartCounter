// ===========================
// DART COUNTER - DartIt Bridge (page side)
// Receives throw tokens relayed by the site service worker (from the Firefox
// add-on) and scores them through the normal input path, so each auto throw
// is individually undoable exactly like a manual one.
// ===========================
'use strict';

window.addEventListener('message', (event) => {
  // Only accept throws relayed by our own service worker.
  if (event.source !== navigator.serviceWorker.controller) return;

  const msg = event.data;
  if (!msg || msg.type !== 'dartit-throw') return;

  // Ignore throws when there's no live game to receive them.
  if (!state.gameStarted || state.gameOver) {
    console.log('[dartit-bridge] page: no active game, ignoring', msg.token);
    return;
  }

  // In cricket only 15-20 (any multiplier) and bull are targetable, mirroring
  // the board which hides 1-14.
  if (isCricket()) {
    const t = String(msg.token).toUpperCase();
    let num;
    if (t === 'BULL' || t === 'BE' || t === '0') {
      num = 25; // bull is targetable in cricket
    } else {
      let s = t;
      if (s.startsWith('T') || s.startsWith('D')) s = s.slice(1);
      const parsed = parseInt(s, 10);
      num = Number.isNaN(parsed) ? null : parsed;
    }
    const targetable = num === 25 || (Number.isInteger(num) && num >= 15 && num <= 20);
    if (!targetable) {
      console.log('[dartit-bridge] page: not a cricket target, ignoring', msg.token);
      return;
    }
  }

  console.log('[dartit-bridge] page: scoring throw', msg.token);
  applyThrowToken(msg.token);
  submitScore();
});
