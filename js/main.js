// ===========================
// DART COUNTER - Initialization
// ===========================
'use strict';

function init() {
  setupEventListeners();
  renderPlayerSuggestions();
  renderNameInputs(3);
  updateNameInputs();
  tryRegisterSW();
}

function tryRegisterSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js')
        .then(() => console.log('SW registered'))
        .catch(() => console.log('SW registration skipped'));
    });
  }
}

function isX01() {
  return state.mode === 'x01';
}

function isCricket() {
  return state.mode === 'cricket';
}

init();
