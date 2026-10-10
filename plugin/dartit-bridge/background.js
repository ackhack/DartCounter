// ===========================
// DARTIT BRIDGE - Background (event page)
// Receives detect responses from the dartit.net content script and broadcasts
// them to every tab. dartcounter-content.js is only injected into the
// DartCounter tab (manifest "matches"), so it is the only tab with a receiver;
// it relays the throw to the site's own service worker. Sends to other tabs
// fail with "no receiving end" and are ignored.
// Also routes recalibration requests from the DartCounter tab to an open
// dartit.net tab, which forwards them to injected.js' startRecalibration.
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
  if (!message) return;

  if (message.type === 'detect') {
    console.log('[dartit-bridge] background got detect:', message.data);
    return broadcastToDartCounterTabs({ type: 'dartit-detect', data: message.data });
  }

  if (message.type === 'calib-complete') {
    return broadcastToDartCounterTabs({ type: 'calib-complete' });
  }

  if (message.type === 'calib-failed') {
    return broadcastToDartCounterTabs({ type: 'calib-failed', data: message.data });
  }

  if (message.type === 'recalibrate') {
    return sendToDartItTab();
  }
});

// Deliver a recalibration request to an open dartit.net tab (the one the
// user is throwing on). Resolves true when the tab accepted the message,
// false otherwise (no dartit tab open, or the tab has no content script —
// e.g. it was not reloaded after the add-on was installed/reloaded). The
// DartCounter content script forwards the result back to the page.
async function sendToDartItTab() {
  let tabs;
  try {
    tabs = await browser.tabs.query({ url: 'https://dartit.net/*' });
  } catch (e) {
    console.warn('[dartit-bridge] tab query failed:', e);
    return false;
  }

  if (!tabs || tabs.length === 0) {
    console.warn('[dartit-bridge] no dartit.net tab open — cannot recalibrate.');
    return false;
  }

  const tab = tabs[0];
  try {
    console.log('[dartit-bridge] sending recalibrate to tab', tab.id, tab.url);
    await browser.tabs.sendMessage(tab.id, { type: 'dartit-recalibrate' });
    console.log('[dartit-bridge] recalibrate delivered to tab', tab.id);
    return true;
  } catch (e) {
    console.warn(
      '[dartit-bridge] could not reach dartit.net tab',
      tab.id,
      '(reload the tab after installing/reloading the add-on):',
      e
    );
    return false;
  }
}

// Deliver a payload (a throw or a calibration-complete event) to every open
// DartCounter tab. dartcounter-content.js is only injected into those tabs,
// so sends to other tabs fail with "no receiving end" and are ignored.
async function broadcastToDartCounterTabs(payload) {
  let tabs;
  try {
    tabs = await browser.tabs.query({});
  } catch (e) {
    console.warn('[dartit-bridge] tab query failed:', e);
    return;
  }

  if (!tabs || tabs.length === 0) {
    console.warn('[dartit-bridge] no tabs open — ignoring event.');
    return;
  }

  let delivered = 0;
  await Promise.all(
    tabs.map(async (tab) => {
      if (!isDartCounterTab(tab.url)) return;
      try {
        await browser.tabs.sendMessage(tab.id, payload);
        delivered++;
        console.log('[dartit-bridge] forwarded', payload.type, 'to tab', tab.id);
      } catch (e) {
        // Expected for tabs without our content script (or not reloaded
        // after the add-on was installed).
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
    console.warn('[dartit-bridge] no tab accepted the', payload.type, 'event.');
  }
}
