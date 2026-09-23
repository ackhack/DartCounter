// Integration test for js/dartit-bridge.js: load the REAL handler in a vm
// context with stubbed app globals, fire fake SW message events, and verify
// the no-game guard, the cricket-target guard, and the applyThrowToken +
// submitScore dispatch. Run: node plugin/dartit-bridge/test/test-page-bridge.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../../', import.meta.url);
const src = readFileSync(new URL('js/dartit-bridge.js', root), 'utf8');

const ORIGIN = 'http://localhost:8080';

function makeWorld(overrides = {}) {
  const calls = { apply: [], submit: 0 };
  let messageHandler = null;

  const controller = Symbol('sw-controller');
  class ServiceWorker {}
  const sandbox = {
    console,
    Symbol,
    ServiceWorker,
    navigator: { serviceWorker: { controller } },
    window: {
      location: { origin: ORIGIN },
      addEventListener(type, fn) {
        if (type === 'message') messageHandler = fn;
      },
    },
    state: {
      gameStarted: true,
      gameOver: false,
      mode: 'x01',
      ...overrides.state,
    },
    isCricket: () => sandbox.state.mode === 'cricket',
    applyThrowToken: (token) => {
      calls.apply.push(token);
    },
    submitScore: () => {
      calls.submit++;
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);

  // Fire a message event as the site SW relay would (source = controller,
  // origin = page origin by default).
  const fire = (data, source = controller, origin = ORIGIN) => {
    messageHandler({ source, data, origin });
  };

  return { fire, calls, controller, messageHandler, state: sandbox.state, ServiceWorker, window: sandbox.window };
}

let failed = 0;
const check = (label, cond) => {
  if (!cond) failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
};

// 1. Normal X01 throw is scored.
{
  const w = makeWorld();
  check('handler registered', typeof w.messageHandler === 'function');
  w.fire({ type: 'dartit-throw', token: 'T11', raw: { numbers: 11, fields: 'T' } });
  check('X01 T11 -> applyThrowToken called with T11', w.calls.apply.length === 1 && w.calls.apply[0] === 'T11');
  check('X01 T11 -> submitScore called once', w.calls.submit === 1);
}

// 2. Non-controller, non-SW source is ignored.
{
  const w = makeWorld();
  w.fire({ type: 'dartit-throw', token: '20' }, 'not-the-sw');
  check('message from non-SW source ignored', w.calls.apply.length === 0 && w.calls.submit === 0);
}

// 2b. Null source (Firefox SW quirk) from same origin is accepted.
{
  const w = makeWorld();
  w.fire({ type: 'dartit-throw', token: '20' }, null);
  check('null-source same-origin message accepted', w.calls.apply.length === 1 && w.calls.submit === 1);
}

// 2c. A ServiceWorker sender (e.g. version-mismatched instance) is accepted.
{
  const w = makeWorld();
  w.fire({ type: 'dartit-throw', token: '20' }, new w.ServiceWorker());
  check('ServiceWorker-source message accepted', w.calls.apply.length === 1 && w.calls.submit === 1);
}

// 2d. Page-script postMessage (source === window) is rejected.
{
  const w = makeWorld();
  w.fire({ type: 'dartit-throw', token: '20' }, w.window);
  check('page-script (window source) message rejected', w.calls.apply.length === 0 && w.calls.submit === 0);
}

// 2e. Different origin is rejected even with a ServiceWorker sender.
{
  const w = makeWorld();
  w.fire({ type: 'dartit-throw', token: '20' }, new w.ServiceWorker(), 'https://evil.example');
  check('cross-origin ServiceWorker-source message rejected', w.calls.apply.length === 0 && w.calls.submit === 0);
}

// 3. Wrong type is ignored.
{
  const w = makeWorld();
  w.fire({ type: 'something-else', token: '20' });
  check('non dartit-throw type ignored', w.calls.apply.length === 0 && w.calls.submit === 0);
}

// 4. No active game (setup screen) -> ignored.
{
  const w = makeWorld({ state: { gameStarted: false } });
  w.fire({ type: 'dartit-throw', token: '20' });
  check('game not started -> ignored', w.calls.apply.length === 0 && w.calls.submit === 0);
}

// 5. Game over -> ignored.
{
  const w = makeWorld({ state: { gameOver: true } });
  w.fire({ type: 'dartit-throw', token: '20' });
  check('game over -> ignored', w.calls.apply.length === 0 && w.calls.submit === 0);
}

// 6. Cricket: non-target number 14 ignored, 16 scored, bull scored.
{
  const w = makeWorld({ state: { mode: 'cricket' } });
  w.fire({ type: 'dartit-throw', token: '14' });
  check('cricket single 14 -> ignored', w.calls.apply.length === 0 && w.calls.submit === 0);

  w.fire({ type: 'dartit-throw', token: '16' });
  check('cricket single 16 -> scored', w.calls.apply.length === 1 && w.calls.submit === 1);

  w.fire({ type: 'dartit-throw', token: 'T20' });
  check('cricket T20 -> scored', w.calls.apply.length === 2 && w.calls.submit === 2);

  w.fire({ type: 'dartit-throw', token: 'Bull' });
  check('cricket Bull -> scored', w.calls.apply.length === 3 && w.calls.submit === 3);

  w.fire({ type: 'dartit-throw', token: '0' });
  check('cricket miss -> scored', w.calls.apply.length === 4 && w.calls.submit === 4);
}

// 7. X01: all numbers accepted (no cricket restriction).
{
  const w = makeWorld();
  w.fire({ type: 'dartit-throw', token: '7' });
  check('x01 single 7 -> scored', w.calls.apply.length === 1 && w.calls.submit === 1);
}

process.exit(failed ? 1 : 0);
