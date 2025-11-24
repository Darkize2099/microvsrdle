// js/ui.js
// Handles DOM + wiring for the default two-card mode and settings menu.

import { getGameState, handleChoice, startNewRound, restartGame } from './gameLogic.js';
import { getStats } from './stats.js';
import { getCharacters } from './dataLoader.js';
import { getSettings, updateSetting } from './settings.js';


function cleanWikiImageUrl(url) {
  if (!url) return '';
  const trimmed = url.trim();
  const idx = trimmed.indexOf('/revision/');
  if (idx !== -1) {
    // Drop "/revision/latest?cb=..." and anything after it
    return trimmed.slice(0, idx);
  }
  return trimmed;
}

function getPrimaryImageUrl(character) {
  if (!character) return '';

  let url = '';

  // 1) If imageUrl exists and looks like a full URL, use it
  if (character.imageUrl && /^https?:\/\//i.test(character.imageUrl)) {
    url = character.imageUrl;
  } else if (character._raw && character._raw.ImageURL) {
    // 2) Use raw JSON ImageURL if present
    url = character._raw.ImageURL;
  } else if (character.ImageURL) {
    // 3) Or a direct ImageURL property
    url = character.ImageURL;
  } else if (character.altImageUrls && character.altImageUrls.length > 0) {
    // 4) Fall back to first altImageUrls entry if it's a full URL
    const firstAlt = character.altImageUrls[0];
    if (/^https?:\/\//i.test(firstAlt)) {
      url = firstAlt;
    }
  }

  return cleanWikiImageUrl(url);
}


function getAltImageUrls(character) {
  if (!character || !character.altImageUrls || !character.altImageUrls.length) {
    return [];
  }

  return character.altImageUrls
    .map(cleanWikiImageUrl)
    .filter(url => /^https?:\/\//i.test(url));
}


let els = {};
let infoPanelVisible = false;

export function initUI() {
  // Core game elements
  els.streakDisplay = document.getElementById('streak-display');

  els.cardLeft = document.getElementById('card-left');
  els.cardRight = document.getElementById('card-right');

  els.infoButton = document.getElementById('info-button');
  els.infoPanel = document.getElementById('info-panel');

  els.nextButton = document.getElementById('next-button');
  els.restartButton = document.getElementById('restart-button');

  if (els.cardLeft) {
    els.cardLeft.addEventListener('click', () => onCardClick('left'));
  }
  if (els.cardRight) {
    els.cardRight.addEventListener('click', () => onCardClick('right'));
  }

  if (els.infoButton && els.infoPanel) {
    els.infoButton.addEventListener('click', toggleInfoPanel);
  }

  if (els.nextButton) {
    els.nextButton.addEventListener('click', () => {
      infoPanelVisible = false;
      restartAndRenderNewRound();
    });
  }

  if (els.restartButton) {
    els.restartButton.addEventListener('click', () => {
      infoPanelVisible = false;
      restartAndRenderNewRound();
    });
  }

  // Settings menu elements
  els.menuToggle = document.getElementById('menu-toggle');
  els.settingsMenu = document.getElementById('settings-menu');
  els.veryHardToggle = document.getElementById('very-hard-toggle');
  els.customModeToggle = document.getElementById('custom-mode-toggle');
  els.customSeriesSection = document.getElementById('custom-series-section');
  els.seriesList = document.getElementById('series-list');
  els.menuApplyButton = document.getElementById('menu-apply-button');
  els.lightModeToggle = document.getElementById('light-mode-toggle');

  if (els.menuToggle && els.settingsMenu) {
    els.menuToggle.addEventListener('click', toggleMenu);
  }

  if (els.customModeToggle && els.customSeriesSection) {
    els.customModeToggle.addEventListener('change', () => {
      const enabled = els.customModeToggle.checked;
      els.customSeriesSection.hidden = !enabled;
    });
  }

  if (els.menuApplyButton) {
    els.menuApplyButton.addEventListener('click', onApplySettings);
  }

  populateSeriesList();
  syncSettingsToUI();

  render();
}

/* ---------- Card clicks ---------- */

function onCardClick(side) {
  const state = getGameState();
  if (!state.currentPair) return;

  const selectedId = side === 'left'
    ? state.currentPair.left.id
    : state.currentPair.right.id;

  const result = handleChoice(selectedId);
  if (!result.valid) return;

  // After a selection, show info panel automatically.
  infoPanelVisible = true;
  render();
}

/* ---------- Info panel toggle ---------- */

function toggleInfoPanel() {
  const state = getGameState();
  if (!state.currentPair) {
    // Nothing to show yet
    return;
  }

  infoPanelVisible = !infoPanelVisible;
  if (els.infoButton) {
    els.infoButton.setAttribute('aria-expanded', String(infoPanelVisible));
  }
  render();
}

/* ---------- Menu + settings ---------- */

function toggleMenu() {
  if (!els.settingsMenu || !els.menuToggle) return;
  const currentlyHidden = els.settingsMenu.hidden;
  els.settingsMenu.hidden = !currentlyHidden;
  els.menuToggle.setAttribute('aria-expanded', String(!currentlyHidden));
}

/**
 * Build the list of series/origins from the character pool.
 */
function populateSeriesList() {
  if (!els.seriesList) return;

  const chars = getCharacters();
  const origins = new Set();
  for (const c of chars) {
    if (c.origin) origins.add(c.origin);
  }

  const sortedOrigins = Array.from(origins).sort((a, b) => a.localeCompare(b));

  els.seriesList.innerHTML = '';
  for (const origin of sortedOrigins) {
    const idSafe = 'series-' + origin.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '');
    const label = document.createElement('label');
    label.className = 'series-option';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'series-filter';
    checkbox.value = origin;
    checkbox.id = idSafe;

    const span = document.createElement('span');
    span.textContent = origin;

    label.appendChild(checkbox);
    label.appendChild(span);
    els.seriesList.appendChild(label);
  }
}

function syncSettingsToUI() {
  const settings = getSettings();

  if (els.veryHardToggle) {
    els.veryHardToggle.checked = !!settings.veryHardMode;
  }
  if (els.customModeToggle) {
    els.customModeToggle.checked = !!settings.customMode;
  }
  if (els.customSeriesSection) {
    els.customSeriesSection.hidden = !settings.customMode;
  }

  if (els.seriesList && Array.isArray(settings.customSeries)) {
    const selectedSet = new Set(settings.customSeries);
    const checkboxes = els.seriesList.querySelectorAll('input[name="series-filter"]');
    checkboxes.forEach(cb => {
      cb.checked = selectedSet.has(cb.value);
    });
  }

  if (els.lightModeToggle) {
    els.lightModeToggle.checked = !!settings.lightMode;
  }

  // Apply theme based on saved setting
  applyTheme(!!settings.lightMode);
}

/**
 * When the user presses Apply in the menu:
 * - Save Very Hard + Custom mode + series list
 * - Restart the run (streak reset, pool recalculated)
 */
function onApplySettings() {
  const veryHard = els.veryHardToggle ? els.veryHardToggle.checked : false;
  const customMode = els.customModeToggle ? els.customModeToggle.checked : false;
  const lightMode = els.lightModeToggle ? els.lightModeToggle.checked : false;

  let selectedSeries = [];
  if (customMode && els.seriesList) {
    const checkboxes = els.seriesList.querySelectorAll('input[name="series-filter"]:checked');
    checkboxes.forEach(cb => selectedSeries.push(cb.value));
  }

  updateSetting('veryHardMode', veryHard);
  updateSetting('customMode', customMode);
  updateSetting('customSeries', selectedSeries);
  updateSetting('lightMode', lightMode);

  // Apply theme immediately
  applyTheme(lightMode);

  // Restart the run (same as before)
  infoPanelVisible = false;
  restartAndRenderNewRound();

  // Close the menu
  if (els.settingsMenu && els.menuToggle) {
    els.settingsMenu.hidden = true;
    els.menuToggle.setAttribute('aria-expanded', 'false');
  }
}


/* ---------- Core render ---------- */

export function render() {
  const state = getGameState();
  const stats = getStats();

  renderStreak(state, stats);
  renderCards(state);
  renderButtons(state);
  renderInfoPanel(state);
}

function renderStreak(state, stats) {
  if (!els.streakDisplay) return;

  const total = stats.totalRounds;
  const correct = stats.totalCorrectRounds;
  const best = stats.bestStreak;

  els.streakDisplay.textContent =
    `Current streak: ${state.streak} | Best: ${best} | Correct: ${correct}/${total}`;
}

function renderCards(state) {
  if (!els.cardLeft || !els.cardRight) return;

  els.cardLeft.disabled = state.phase !== 'inRound';
  els.cardRight.disabled = state.phase !== 'inRound';

  if (!state.currentPair) {
    els.cardLeft.textContent = 'Loading...';
    els.cardRight.textContent = 'Loading...';
    return;
  }

  const { left, right } = state.currentPair;

  renderCard(els.cardLeft, left, state);
  renderCard(els.cardRight, right, state);
}

function renderCard(cardElement, character, state) {
  if (!character) {
    cardElement.textContent = '???';
    return;
  }

  const isResultPhase = state.phase === 'afterCorrect' || state.phase === 'afterWrong';
  const isCorrect =
    isResultPhase && character.id === state.correctId;

  const baseClass = 'vs-card';
  const extraClass = isResultPhase
    ? (isCorrect ? ' vs-card-correct' : ' vs-card-incorrect')
    : '';

  cardElement.className = `${baseClass}${extraClass}`;

  // --- Wiki URL–aware image handling ---

  const primaryImageUrl = getPrimaryImageUrl(character);
  const altImageUrls = getAltImageUrls(character);

  const hasAnyImage = !!primaryImageUrl || altImageUrls.length > 0;
  const altImagesAttr = altImageUrls.length ? altImageUrls.join('|') : '';

  cardElement.innerHTML = `
    <div class="card-inner">
      <div class="card-name">${character.name}</div>
      <div class="card-origin">${character.origin}</div>
      <div class="card-image-wrapper">
        ${
          hasAnyImage
            ? `<img src="${primaryImageUrl || altImageUrls[0]}"
                     alt="${character.name}"
                     class="card-image"
                     data-alt-images="${altImagesAttr}" />`
            : `<div class="card-image card-image-placeholder">No image</div>`
        }
      </div>
      ${
        isResultPhase
          ? `<div class="card-tier">
               <span class="card-main-tier">${character.mainTier || '-'}</span>
               <span class="card-sub-tier">${character.highestTier || '-'}</span>
             </div>`
          : ''
      }
    </div>
  `;

  // Attach onerror handler to try altImageUrls, then placeholder
  if (hasAnyImage) {
    const img = cardElement.querySelector('.card-image');
    if (img) {
      let altList = [];
      if (img.dataset.altImages) {
        altList = img.dataset.altImages.split('|').filter(Boolean);
        const currentSrc = img.getAttribute('src');
        altList = altList.filter(url => url !== currentSrc);
      }

      img.addEventListener('error', function handleError() {
        if (altList.length > 0) {
          const next = altList.shift();
          img.src = next;
        } else {
          img.removeEventListener('error', handleError);
          // Generic online placeholder to avoid 404s
          img.src = 'https://via.placeholder.com/256x256?text=No+Image';
        }
      });
    }
  }
}

function renderButtons(state) {
  if (els.nextButton) {
    els.nextButton.hidden = state.phase !== 'afterCorrect';
  }
  if (els.restartButton) {
    els.restartButton.hidden = state.phase !== 'afterWrong';
  }
}

/**
 * Only show info when:
 *  - infoPanelVisible is true
 *  - we have a current pair
 */
function renderInfoPanel(state) {
  if (!els.infoPanel) return;

  if (!infoPanelVisible || !state.currentPair) {
    els.infoPanel.hidden = true;
    els.infoPanel.innerHTML = '';
    return;
  }

  const { left, right } = state.currentPair;
  const resultPhase = state.phase === 'afterCorrect' || state.phase === 'afterWrong';

  const leftLink = (resultPhase && left.pageUrl)
    ? `<a href="${left.pageUrl}" target="_blank" rel="noopener">Open Wiki for ${left.name}</a>`
    : '';
  const rightLink = (resultPhase && right.pageUrl)
    ? `<a href="${right.pageUrl}" target="_blank" rel="noopener">Open Wiki for ${right.name}</a>`
    : '';

  els.infoPanel.hidden = false;
  els.infoPanel.innerHTML = `
    <div class="info-side">
      <h3>${left.name}</h3>
      <p>${left.summary || 'No summary available.'}</p>
      ${leftLink}
    </div>
    <div class="info-side">
      <h3>${right.name}</h3>
      <p>${right.summary || 'No summary available.'}</p>
      ${rightLink}
    </div>
  `;
}

function applyTheme(lightMode) {
  // Toggle a class on <body>, so CSS can switch colors.
  document.body.classList.toggle('light-theme', lightMode);
}


/* ---------- Helpers ---------- */

function restartAndRenderNewRound() {
  restartGame();
  render();
}

export { getPrimaryImageUrl, getAltImageUrls };
