// js/main.js
// Bootstraps the app, loads data once, initializes both modes,
// but only activates the selected one (default = classic Vs mode)

import { loadTierHierarchy, loadMicroOrigins, loadAllCharacters } from './dataLoader.js';
import { loadSettings, getSettings } from './settings.js';
import { loadStats } from './stats.js';

// Classic 2-card mode
import { initGameState, startNewRound } from './gameLogic.js';
import { initUI, render as renderUI } from './ui.js';

// Odd-One-Out mode
import { initOddGameState, startNewOddRound } from './gameLogicOdd.js';
import { initOddUI, renderOdd } from './uiOdd.js';

let currentMode = 'vs'; // 'vs' or 'odd'

function showVsMode() {
  currentMode = 'vs';

  // Show VS UI section, hide Odd UI section
  document.getElementById('game-section').style.display = 'block';
  document.getElementById('odd-mode-section').style.display = 'none';

  initGameState();
  startNewRound();
  renderUI();
}

function showOddMode() {
  currentMode = 'odd';

  // Show Odd UI section, hide VS UI section
  document.getElementById('game-section').style.display = 'none';
  document.getElementById('odd-mode-section').style.display = 'block';

  initOddGameState();
  startNewOddRound();
  renderOdd();
}

function wireModeButtons() {
  const vsButton = document.getElementById('mode-vs-button');
  const oddButton = document.getElementById('mode-odd-button');

  if (vsButton) {
    vsButton.addEventListener('click', () => {
      showVsMode();
    });
  }

  if (oddButton) {
    oddButton.addEventListener('click', () => {
      showOddMode();
    });
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  loadSettings();
  loadStats();

  await loadTierHierarchy();
  await loadMicroOrigins();
  await loadAllCharacters();

  // Initialize both UIs so buttons exist and won't error
  initUI();
  initOddUI();
  wireModeButtons();

  // Default mode is classic VS
  showVsMode();
});
