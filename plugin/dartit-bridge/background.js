// ===========================
// DARTIT BRIDGE - Background (event page)
// Receives detect responses from the dartit.net content script and broadcasts
// them to every tab. dartcounter-content.js is only injected into the
// DartCounter tab (manifest "matches"), so it is the only tab with a receiver;
// it relays the throw to the site's own service worker. Sends to other tabs
// fail with "no receiving end" and are ignored.
// ===========================
'use strict';

// Tabs where dartcounter-content.js is injected (see manifest matches): any
// port on localhost or the LAN IP. Used only to decide whether a failed send
// deserves a warning.
function isDartCounterTab(url) {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return (
      u.protocol === 'http:' &&
      (u.hostname === 'localhost' || u.hostname === '192.168.178.92')
    );
  } catch (e) {
    return false;
  }
}

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
  console.log(tabs.length + ' tabs');

  let delivered = 0;
  await Promise.all(
    tabs.map(async (tab) => {
      if (!isDartCounterTab(tab.url)) return;
      try {
        console.log('[dartit-bridge] sending to tab ' + tab.id + " with url " + tab.url);
        await browser.tabs.sendMessage(tab.id, { type: 'dartit-detect', data: data });
        delivered++;
        console.log('[dartit-bridge] forwarded to tab', tab.id);
      } catch (e) {
        // Expected for tabs without our content script (or not reloaded after
        // the add-on was installed). Only warn if it looks like our tab.
        console.warn(
          '[dartit-bridge] could not reach DartCounter tab',
          tab.id,
          '(reload the tab after installing/reloading the add-on):',
          e
        );
      }
    })
  );

  if (delivered === 0) {
    console.warn('[dartit-bridge] no tab accepted the throw.');
  }
}
