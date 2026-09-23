// ===========================
// DARTIT BRIDGE - Background (MV3 service worker)
// Receives detect responses from the dartit.net content script and forwards
// them to the DartCounter tab's content script, which relays them to the
// site's own service worker.
// ===========================
'use strict';

const DARTCOUNTER_URL = 'http://localhost:8080/*';

browser.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== 'detect') return;

  console.log('[dartit-bridge] background got detect:', message.data);
  return forwardToDartCounter(message.data);
});

async function forwardToDartCounter(data) {
  let tabs;
  try {
    tabs = await browser.tabs.query({ url: DARTCOUNTER_URL });
  } catch (e) {
    console.warn('[dartit-bridge] tab query failed:', e);
    return;
  }

  if (!tabs || tabs.length === 0) {
    console.warn('[dartit-bridge] no DartCounter tab open — ignoring throw.');
    return;
  }

  const tab = tabs[0];
  try {
    await browser.tabs.sendMessage(tab.id, { type: 'dartit-detect', data: data });
    console.log('[dartit-bridge] forwarded to DartCounter tab', tab.id);
  } catch (e) {
    console.warn(
      '[dartit-bridge] could not reach DartCounter tab ' +
        '(reload the tab after installing/reloading the add-on):',
      e
    );
  }
}
