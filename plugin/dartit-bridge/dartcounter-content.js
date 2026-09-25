// ===========================
// DARTIT BRIDGE - DartCounter content script (isolated world)
// Runs on the local DartCounter site. Receives throws from the extension
// background and relays them to the site's own service worker.
// ===========================
(() => {
  'use strict';

  browser.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== 'dartit-detect') return;

    document.getElementById("dartit-bridge-value").innerText = JSON.stringify(message.data)
    document.getElementById("dartit-bridge-count").innerText =
      parseInt(document.getElementById("dartit-bridge-count").innerText) + 1;
  });
})();
