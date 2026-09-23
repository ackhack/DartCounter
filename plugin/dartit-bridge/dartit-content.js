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
})();
