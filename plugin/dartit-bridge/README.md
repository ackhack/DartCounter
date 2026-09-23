# DartIt → DartCounter Bridge (Firefox add-on)

Captures every detect response that `dartit.net` gets from
`https://vis.dartit.net/detect` and forwards each throw to the local DartCounter
site, where it is auto-scored through the normal input path (so each auto throw
is individually undoable, exactly like a manual one).

## How it works

```
dartit.net page
  └─ injected.js            (MAIN world)  wraps fetch/XHR, captures the JSON
       └─ dartit-content.js  (isolated)   window.message → runtime.sendMessage
            └─ background.js              finds the DartCounter tab
                 └─ dartcounter-content.js (isolated, localhost:8080)
                      └─ site service-worker.js   parses the throw, relays it
                           └─ js/dartit-bridge.js  (page) applyThrowToken + submitScore
```

- `injected.js` runs in the page's own JS context (`world: MAIN`, `document_start`)
  so it can see the real `fetch`/`XMLHttpRequest`. It only acts on non-GET requests
  to `vis.dartit.net/detect` and posts the parsed JSON body to the content script.
- The site's service worker (`service-worker.js`) turns the raw response into a
  throw token via `parseDetect()` and relays it to every open window.
- `js/dartit-bridge.js` on the page applies the token and scores it. It ignores
  throws when there is no live game, and in cricket it only accepts targetable
  numbers (15–20, any multiplier) plus bull/bullseye/miss — mirroring the board.

## Install (temporary add-on)

1. Make sure the DartCounter site is being served, e.g.
   `python3 -m http.server 8080` from the project root.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and select this folder's `manifest.json`.
4. (Re)load the DartCounter tab at `http://localhost:8080`.
5. Reload `https://dartit.net/...` so the content scripts attach.

The add-on is temporary — it disappears when Firefox closes. Repeat steps 2–3 to
reload it after editing (then reload both tabs again).

## If a different port

The add-on targets `http://localhost:8080`. To use another port, change
`http://localhost:8080/*` in both `manifest.json` (host_permissions and the
content_scripts `matches`) and `background.js` (`DARTCOUNTER_URL`), then reload
the add-on and the tab.

## Tests

With a JavaScript runtime available (node):

```
node plugin/dartit-bridge/test/test-parse-detect.mjs   # parseDetect + token round-trip
node plugin/dartit-bridge/test/test-page-bridge.mjs    # page-side guards + dispatch
```

These cover the pure-logic parts. The Firefox-specific hops (MAIN-world hook,
runtime messaging, tab lookup, `reg.active.postMessage`) need a live browser.

## Debugging

- Page console (dartit.net tab): `[dartit-bridge] detect response: {...}`.
- Add-on background console: `about:debugging` → the add-on → **Inspect** →
  `[dartit-bridge] background got detect:` / `forwarded to DartCounter tab`.
- DartCounter tab console: `[dartit-bridge] sent throw to site service worker`.
- Site service worker console (DartCounter tab → Application → Service Workers →
  inspect): `[dartit-bridge] site SW got detect:` / `parsed token:`.
- DartCounter page console: `[dartit-bridge] page: scoring throw <token>`.

If a throw doesn't land, the warning at the first missing hop tells you where the
chain broke (most common: the DartCounter tab wasn't reloaded after the add-on
was (re)installed).
