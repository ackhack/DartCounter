// ===========================
// DARTIT BRIDGE - Page-context hook (MAIN world)
// Runs inside dartit.net pages. Wraps fetch() and XMLHttpRequest so every
// non-GET request to vis.dartit.net/detect has its JSON response captured
// and handed to the isolated content script via window.postMessage.
// Also watches the detection status icon and runs the auto-recalibration
// sequence when it changes (see the recalibration section below).
// ===========================
(() => {
  'use strict';

  const TARGET = 'vis.dartit.net/detect';
  const SOURCE = 'dartit-bridge-inject';

  function emit(data) {
    try {
      window.postMessage(
        { source: SOURCE, type: 'DARTIT_DETECT', data: data },
        window.location.origin
      );
    } catch (e) {
      // never break the host page
    }
  }

  function isDetect(url) {
    return typeof url === 'string' && url.includes(TARGET);
  }

  function isNonGet(method) {
    return String(method || 'GET').toUpperCase() !== 'GET';
  }

  // The detect endpoint can answer with an empty object or nothing at all.
  // Only a non-empty plain object carries a throw, so drop everything else
  // before it enters the extension chain.
  function isMeaningful(data) {
    const meaningful = (
      data !== null &&
      typeof data === 'object' &&
      !Array.isArray(data) &&
      Object.keys(data).length > 0
    );
    if (!meaningful) {
      console.log('Not meaningful');
    }
    return meaningful;
  }

  // --- fetch ---
  const origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (input, init) {
      const url =
        typeof input === 'string' ? input : (input && input.url) || '';
      const method =
        (init && init.method) || (input && input.method) || 'GET';

      const promise = origFetch.apply(this, arguments);

      if (isDetect(url) && isNonGet(method)) {
        promise
          .then((res) => {
            try {
              res
                .clone()
                .json()
                .then((data) => {
                  if (isMeaningful(data)) emit(data);
                })
                .catch(() => { });
            } catch (e) {
              // not a readable response — skip
            }
          })
          .catch(() => { });
      }
      return promise;
    };
  }

  // --- XMLHttpRequest ---
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__bridgeMethod = method;
    this.__bridgeUrl = url;
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    if (isDetect(this.__bridgeUrl) && isNonGet(this.__bridgeMethod)) {
      this.addEventListener('load', () => {
        try {
          const data = JSON.parse(this.responseText);
          if (isMeaningful(data)) emit(data);
        } catch (e) {
          // empty or non-JSON body — skip
        }
      });
    }
    return origSend.apply(this, arguments);
  };

  // --- auto recalibration ---
  // The detection status icon (icons[0].children[0]) changes when the
  // camera detection needs recalibration. When it changes we run:
  //   1. press icons[0].children[1] (the calibration button) — its subtree
  //      changes twice: once when the run starts, once when it finishes
  //   2. when the run is finished, press icons[0].children[0], which
  //      reveals a menu containing a span with the text 'Reset Detection'
  //   3. press that span's grandparent (the menu button)
  const RECAL_GRACE_MS = 5000;         // ignore status changes right after a reset
  const RECAL_RESET_TIMEOUT_MS = 15000; // how long to wait for the reset menu
  const RECAL_CALIB_TIMEOUT_MS = 60000; // give up on a stuck calibration run
  const RECAL_MUT_CONFIG = {
    childList: true,
    subtree: false,
    attributes: false,
    characterData: false
  };

  const recalc = {
    busy: false,
    graceUntil: 0,
    watched: null,
    observer: null
  };

  function iconsEl() {
    const list = document.getElementsByClassName('icons');
    return list && list[0] ? list[0] : null;
  }

  function attachStatusWatcher() {
    try {
      const container = iconsEl();
      if (!container || !container.children[0]) return;
      if (
        recalc.watched &&
        recalc.watched.isConnected &&
        container === recalc.watched
      ) {
        return; // still watching the same live node
      }
      if (recalc.observer) recalc.observer.disconnect();
      recalc.watched = container;
      console.log('[dartit-bridge] attaching watcher');
      recalc.observer = new MutationObserver(onStatusChange);
      recalc.observer.observe(recalc.watched, RECAL_MUT_CONFIG);
      console.log('[dartit-bridge] recalibration watcher attached');
    } catch (e) {
      // never break the host page
    }
  }

  function onStatusChange() {
    if (!document.getElementsByTagName('app-settings-insights')[0].children[1].children[0].innerText.includes('Stopped')) {
      console.log('not stopped')
      return;
    }
    if (!recalc.watched || !recalc.watched.isConnected) {
      // the icon bar was re-rendered — the poller re-attaches
      recalc.watched = null;
      if (recalc.observer) {
        recalc.observer.disconnect();
        recalc.observer = null;
      }
      return;
    }
    startRecalibration();
  }

  function startRecalibration() {
    if (recalc.busy || Date.now() < recalc.graceUntil) return;
    try {
      recalc.busy = true;

      setTimeout(() => {
        const container = iconsEl();
        const a = container && container.children[0];
        if (a) {
          container.children[0].click()
          setTimeout(pressResetDetection, 100);
        }
      }, 100);
    } catch (e) {
    }
  }

  function pressResetDetection() {

    try {

      const findResetButton = () => {
        const spans = document.querySelectorAll('span');
        for (let i = 0; i < spans.length; i++) {
          const span = spans[i];
          if (span.textContent && span.textContent.trim() === 'Reset Detection') {
            return span.parentElement;
          }
        }
        return null;
      };

      const done = (btn) => {
        recalc.busy = false;
        // the reset itself changes the status icon — give it a moment so we
        // don't immediately re-trigger the whole sequence
        recalc.graceUntil = Date.now() + RECAL_GRACE_MS;
        if (btn) {
          console.log('[dartit-bridge] pressing Reset Detection');
          btn.click();
        }
      };

      const found = findResetButton();
      if (found) {
        done(found);
        return;
      }

      const poll = setInterval(() => {
        const btn = findResetButton();
        if (!btn) return;
        clearInterval(poll);
        clearTimeout(giveUp);
        done(btn);
      }, 100);
      const giveUp = setTimeout(() => {
        clearInterval(poll);
        console.warn('[dartit-bridge] Reset Detection button never appeared');
        done(null);
      }, RECAL_RESET_TIMEOUT_MS);

    } catch (e) {
    }
    recalc.busy = false;
  }

  function startRecalibrationWatcher() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attachStatusWatcher);
    } else {
      attachStatusWatcher();
    }
    // the dartit SPA may re-render the icon bar — re-check once a second
    setInterval(attachStatusWatcher, 1000);
  }
  startRecalibrationWatcher();
})();
