// ===========================
// DARTIT BRIDGE - DartCounter content script (isolated world)
// Runs on the local DartCounter site. Receives throws from the extension
// background and relays them to the site's own service worker.
// ===========================
(() => {
  'use strict';

  browser.runtime.onMessage.addListener((message) => {
    if (!message) return;

    if (message.type === 'dartit-detect') {
      document.getElementById("dartit-bridge-value").innerText = JSON.stringify(message.data)
      document.getElementById("dartit-bridge-count").innerText =
        parseInt(document.getElementById("dartit-bridge-count").innerText) + 1;
      return;
    }

    if (message.type === 'calib-complete') {
      try {
        window.postMessage(
          { source: 'dartit-bridge', type: 'CALIB_COMPLETE' },
          window.location.origin
        );
      } catch (e) {
        // never break the host page
      }
      return;
    }

    if (message.type === 'calib-failed') {
      try {
        window.postMessage(
          { source: 'dartit-bridge', type: 'CALIB_FAILED', data: message.data },
          window.location.origin
        );
      } catch (e) {
        // never break the host page
      }
    }
  });

  // Requests posted by the page (window.postMessage) are relayed to the
  // extension background, which delivers them to the dartit.net tab. The
  // reply (whether a dartit tab was reached) is posted back to the page so
  // the button can give feedback.
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.source !== 'dartcounter-bridge') return;
    if (msg.type !== 'RECALIBRATE') return;

    const origin = event.origin;
    const ack = (ok) => {
      try {
        window.postMessage(
          { source: 'dartit-bridge', type: 'RECALIBRATE_ACK', ok: !!ok },
          origin
        );
      } catch (e) {
        // page may be gone — nothing to do
      }
    };

    try {
      browser.runtime
        .sendMessage({ type: 'recalibrate' })
        .then(ack)
        .catch(() => ack(false));
    } catch (e) {
      // extension context invalidated (e.g. add-on reloaded)
      ack(false);
    }
  });
})();
