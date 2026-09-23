// ===========================
// DARTIT BRIDGE - Background (event page)
// Receives detect responses from the dartit.net content script and broadcasts
// them to every tab. dartcounter-content.js is only injected into the
// DartCounter tab (manifest "matches"), so it is the only tab with a receiver;
// it relays the throw to the site's own service worker. Sends to other tabs
// fail with "no receiving end" and are ignored.
// ===========================
'use strict';

browser.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== 'detect') return;

  console.log('[dartit-bridge] background got detect:', message.data);
  return broadcastToAllTabs(message.data);
});

async function broadcastToAllTabs(data) {
  let tabs;
  try {
    tabs = await browser.tabs.query({});
  } catch (e) {
    console.warn('[dartit-bridge] tab query failed:', e);
    return;
  }

  if (!tabs || tabs.length === 0) {
    console.warn('[dartit-bridge] no tabs open — ignoring throw.');
    return;
  }

  let delivered = 0;
  await Promise.all(
    tabs.map(async (tab) => {
      try {
        await browser.tabs.sendMessage(tab.id, { type: 'dartit-detect', data: data });
        delivered++;
        console.log('[dartit-bridge] forwarded to tab', tab.id);
      } catch (e) {
        // Expected for tabs without our content script (or not reloaded after
        // the add-on was installed). Only warn if it looks like our tab.
        if (tab.url && tab.url.startsWith('http://localhost:8080')) {
          console.warn(
            '[dartit-bridge] could not reach DartCounter tab',
            tab.id,
            '(reload the tab after installing/reloading the add-on):',
            e
          );
        }
      }
    })
  );

  if (delivered === 0) {
    console.warn('[dartit-bridge] no tab accepted the throw.');
  }
}
