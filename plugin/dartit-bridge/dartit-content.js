// ===========================
// DARTIT BRIDGE - dartit.net content script (isolated world)
// Receives detect responses posted by injected.js and forwards them to the
// extension background.
// ===========================
(() => {
  'use strict';

  const SOURCE = 'dartit-bridge-inject';

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.origin !== 'https://dartit.net') return;

    const msg = event.data;
    if (!msg || msg.source !== SOURCE || msg.type !== 'DARTIT_DETECT') return;

    console.log('[dartit-bridge] detect response:', msg.data);

    try {
      browser.runtime.sendMessage({ type: 'detect', data: msg.data }).catch(() => {
        // background not ready / no listener — nothing to do
      });
    } catch (e) {
      // extension context invalidated (e.g. add-on reloaded)
    }
  });

  // Requests from the extension background (the DartCounter "Recalibrate"
  // button) are handed to the page; injected.js listens for them and runs
  // startRecalibration().
  browser.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== 'dartit-recalibrate') return;

    console.log('[dartit-bridge] recalibration requested');
    try {
      window.postMessage(
        { source: 'dartit-bridge', type: 'RECALIBRATE' },
        window.location.origin
      );
    } catch (e) {
      // never break the host page
    }
  });
})();
