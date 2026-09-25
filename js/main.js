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

init();
