// ===========================
// DARTIT BRIDGE - Page-context hook (MAIN world)
// Runs inside dartit.net pages. Wraps fetch() and XMLHttpRequest so every
// non-GET request to vis.dartit.net/detect has its JSON response captured
// and handed to the isolated content script via window.postMessage.
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
              res.clone().json().then(emit).catch(() => {});
            } catch (e) {
              // not a readable response — skip
            }
          })
          .catch(() => {});
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
          emit(JSON.parse(this.responseText));
        } catch (e) {
          // non-JSON body — skip
        }
      });
    }
    return origSend.apply(this, arguments);
  };
})();
