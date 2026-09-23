// ===========================
// DARTIT BRIDGE - DartCounter content script (isolated world)
// Runs on the local DartCounter site. Receives throws from the extension
// background and relays them to the site's own service worker.
// ===========================
(() => {
  'use strict';

  browser.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== 'dartit-detect') return;

    const payload = { type: 'dartit-detect', data: message.data };

    if (!('serviceWorker' in navigator)) {
      console.warn('[dartit-bridge] this page has no serviceWorker support');
      return;
    }

    navigator.serviceWorker
      .ready
      .then((reg) => {
        if (reg && reg.active) {
          reg.active.postMessage(payload);
          console.log('[dartit-bridge] sent throw to site service worker');
        } else {
          console.warn('[dartit-bridge] no active site service worker');
        }
      })
      .catch((e) => {
        console.warn('[dartit-bridge] could not reach site service worker:', e);
      });
  });
})();
