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
                .catch(() => {});
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
          const data = JSON.parse(this.responseText);
          if (isMeaningful(data)) emit(data);
        } catch (e) {
          // empty or non-JSON body — skip
        }
      });
    }
    return origSend.apply(this, arguments);
  };
})();
