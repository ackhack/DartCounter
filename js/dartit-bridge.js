// ===========================
// DART COUNTER - DartIt Bridge (page side)
// Receives throw tokens relayed by the site service worker (from the Firefox
// add-on) and scores them through the normal input path, so each auto throw
// is individually undoable exactly like a manual one.
// ===========================
'use strict';

window.addEventListener('message', (event) => {
  console.log('msg arrived');
  // Accept throws relayed by our service worker. In Firefox the MessageEvent
  // source for SW messages is not always === navigator.serviceWorker.controller
  // (it can be null or a different instance), so also accept a same-origin
  // ServiceWorker sender (or a null source, which page scripts cannot produce
  // — their postMessage carries source === window).
  const controller = navigator.serviceWorker.controller;
  const src = event.source;
  const fromOurSW =
    src === controller ||
    (event.origin === window.location.origin &&
      src !== window &&
      (src === null ||
        (src && src.constructor && src.constructor.name === 'ServiceWorker')));
  if (!fromOurSW) {
    if (event.data && event.data.type === 'dartit-throw') {
      console.warn(
        '[dartit-bridge] page: dartit-throw rejected by source check — source:', src,
        'controller:', controller, 'origin:', event.origin
      );
    }
    return;
  }
console.log('msg arrived 2');
  const msg = event.data;
  if (!msg || msg.type !== 'dartit-throw') return;
console.log('msg arrived 3');
  // Ignore throws when there's no live game to receive them.
  if (!state.gameStarted || state.gameOver) {
    console.log('[dartit-bridge] page: no active game, ignoring', msg.token);
    return;
  }
console.log('msg arrived'); 4
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
