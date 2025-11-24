// js/ui.js
// Handles DOM + wiring for the default two-card mode and settings menu + Rules modal.

import { getGameState, handleChoice, startNewRound, restartGame } from './gameLogic.js';
import { getStats } from './stats.js';
import { getCharacters } from './dataLoader.js';
import { getSettings, updateSetting } from './settings.js';

/* --------------------------------------------------
   IMAGE UTILITIES
-------------------------------------------------- */

function cleanWikiImageUrl(url) {
  if (!url) return '';
  const trimmed = url.trim();
  const idx = trimmed.indexOf('/revision/');
  return idx !== -1 ? trimmed.slice(0, idx) : trimmed;
}

function getPrimaryImageUrl(character) {
  if (!character) return '';
  let url = '';

  if (character.imageUrl && /^https?:\/\//i.test(character.imageUrl)) {
    url = character.imageUrl;
  } else if (character._raw?.ImageURL) {
    url = character._raw.ImageURL;
  } else if (character.ImageURL) {
    url = character.ImageURL;
  } else if (character.altImageUrls?.length > 0) {
    const firstAlt = character.altImageUrls[0];
    if (/^https?:\/\//i.test(firstAlt)) url = firstAlt;
  }

  return cleanWikiImageUrl(url);
}

function getAltImageUrls(character) {
  if (!character?.altImageUrls?.length) return [];
  return character.altImageUrls
    .map(cleanWikiImageUrl)
    .filter(url => /^https?:\/\//i.test(url));
}

/* --------------------------------------------------
   UI STATE + ELEMENT REFERENCES
-------------------------------------------------- */

let els = {};
let infoPanelVisible = false;

/* --------------------------------------------------
   INIT UI
-------------------------------------------------- */

export function initUI() {
  // Core game elements
  els.streakDisplay = document.getElementById('streak-display');
  els.cardLeft = document.getElementById('card-left');
  els.cardRight = document.getElementById('card-right');

  els.infoButton = document.getElementById('info-button');
  els.infoPanel = document.getElementById('info-panel');

  els.nextButton = document.getElementById('next-button');
  els.restartButton = document.getElementById('restart-button');

  // Rules modal elements
  els.rulesButton = document.getElementById('rules-button');
  els.rulesModal = document.getElementById('rules-modal');
  els.rulesCloseButton = document.getElementById('rules-close-button');

  // Card click wiring
  els.cardLeft?.addEventListener('click', () => onCardClick('left'));
  els.cardRight?.addEventListener('click', () => onCardClick('right'));

  // Info toggle
  els.infoButton?.addEventListener('click', toggleInfoPanel);

  // Next / Restart buttons
  els.nextButton?.addEventListener('click', () => {
    infoPanelVisible = false;
    restartAndRenderNewRound();
  });

  els.restartButton?.addEventListener('click', () => {
    infoPanelVisible = false;
    restartAndRenderNewRound();
  });

  /* ---------- RULES MODAL ---------- */

  if (els.rulesButton && els.rulesModal) {
    els.rulesButton.addEventListener('click', () => {
      els.rulesModal.hidden = false;
    });
  }

  if (els.rulesCloseButton && els.rulesModal) {
    els.rulesCloseButton.addEventListener('click', () => {
      els.rulesModal.hidden = true;
    });
  }

  const backdrop = els.rulesModal?.querySelector('.rules-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      els.rulesModal.hidden = true;
    });
  }

  /* ---------- SETTINGS MENU ---------- */

  els.menuToggle = document.getElementById('menu-toggle');
  els.settingsMenu = document.getElementById('settings-menu');
  els.veryHardToggle = document.getElementById('very-hard-toggle');
  els.customModeToggle = document.getElementById('custom-mode-toggle');
  els.customSeriesSection = document.getElementById('custom-series-section');
  els.seriesList = document.getElementById('series-list');
  els.menuApplyButton = document.getElementById('menu-apply-button');
  els.lightModeToggle = document.getElementById('light-mode-toggle');

  els.menuToggle?.addEventListener('click', toggleMenu);

  els.customModeToggle?.addEventListener('change', () => {
    const enabled = els.customModeToggle.checked;
    els.customSeriesSection.hidden = !enabled;
  });

  els.menuApplyButton?.addEventListener('click', onApplySettings);

  populateSeriesList();
  syncSettingsToUI();

  render();
}

/* --------------------------------------------------
   CARD CLICK HANDLING
-------------------------------------------------- */

function onCardClick(side) {
  const state = getGameState();
  if (!state.currentPair) return;

  const selectedId = side === 'left'
    ? state.currentPair.left.id
    : state.currentPair.right.id;

  const result = handleChoice(selectedId);
  if (!result.valid) return;

  infoPanelVisible = true;
  render();
}

/* --------------------------------------------------
   INFO PANEL TOGGLE
-------------------------------------------------- */

function toggleInfoPanel() {
  const state = getGameState();
  if (!state.currentPair) return;
  infoPanelVisible = !infoPanelVisible;
  els.infoButton?.setAttribute('aria-expanded', String(infoPanelVisible));
  render();
}

/* --------------------------------------------------
   SETTINGS MENU
-------------------------------------------------- */

function toggleMenu() {
  if (!els.settingsMenu || !els.menuToggle) return;
  const nowHidden = !els.settingsMenu.hidden;
  els.settingsMenu.hidden = nowHidden;
  els.menuToggle.setAttribute('aria-expanded', String(!nowHidden));
}

function populateSeriesList() {
  if (!els.seriesList) return;
  const chars = getCharacters();
  const origins = Array.from(new Set(chars.map(c => c.origin).filter(Boolean))).sort();
  els.seriesList.innerHTML = origins.map(origin => {
    const idSafe = 'series-' + origin.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '');
    return `
      <label class="series-option">
        <input type="checkbox" name="series-filter" value="${origin}" id="${idSafe}">
        <span>${origin}</span>
      </label>`;
  }).join('');
}

function syncSettingsToUI() {
  const settings = getSettings();
  els.veryHardToggle.checked = !!settings.veryHardMode;
  els.customModeToggle.checked = !!settings.customMode;
  els.customSeriesSection.hidden = !settings.customMode;

  const selectedSet = new Set(settings.customSeries);
  els.seriesList.querySelectorAll('input[name="series-filter"]').forEach(cb => {
    cb.checked = selectedSet.has(cb.value);
  });

  els.lightModeToggle.checked = !!settings.lightMode;
  applyTheme(settings.lightMode);
}

function onApplySettings() {
  const veryHard = els.veryHardToggle.checked;
  const customMode = els.customModeToggle.checked;
  const lightMode = els.lightModeToggle.checked;

  let selectedSeries = [];
  if (customMode) {
    els.seriesList.querySelectorAll('input[name="series-filter"]:checked')
      .forEach(cb => selectedSeries.push(cb.value));
  }

  updateSetting('veryHardMode', veryHard);
  updateSetting('customMode', customMode);
  updateSetting('customSeries', selectedSeries);
  updateSetting('lightMode', lightMode);

  applyTheme(lightMode);

  infoPanelVisible = false;
  restartAndRenderNewRound();

  els.settingsMenu.hidden = true;
  els.menuToggle.setAttribute('aria-expanded', 'false');
}

/* --------------------------------------------------
   CORE RENDER
-------------------------------------------------- */

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
  els.streakDisplay.textContent =
    `Current streak: ${state.streak} | Best: ${stats.bestStreak} | Correct: ${stats.totalCorrectRounds}/${stats.totalRounds}`;
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

  renderCard(els.cardLeft, state.currentPair.left, state);
  renderCard(els.cardRight, state.currentPair.right, state);
}

function renderCard(cardElement, character, state) {
  if (!character) {
    cardElement.textContent = '???';
    return;
  }

  const isResultPhase =
    state.phase === 'afterCorrect' || state.phase === 'afterWrong';
  const isCorrect = isResultPhase && character.id === state.correctId;

  cardElement.className =
    'vs-card' + (isResultPhase ? (isCorrect ? ' vs-card-correct' : ' vs-card-incorrect') : '');

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

  if (hasAnyImage) {
    const img = cardElement.querySelector('.card-image');
    if (img) {
      let altList = img.dataset.altImages ? img.dataset.altImages.split('|') : [];
      const currentSrc = img.getAttribute('src');
      altList = altList.filter(url => url !== currentSrc);

      img.addEventListener('error', function handleError() {
        if (altList.length > 0) {
          const next = altList.shift();
          img.src = next;
        } else {
          img.removeEventListener('error', handleError);
          img.src = 'https://via.placeholder.com/256x256?text=No+Image';
        }
      });
    }
  }
}

function renderButtons(state) {
  els.nextButton.hidden = state.phase !== 'afterCorrect';
  els.restartButton.hidden = state.phase !== 'afterWrong';
}

function renderInfoPanel(state) {
  if (!els.infoPanel) return;

  if (!infoPanelVisible || !state.currentPair) {
    els.infoPanel.hidden = true;
    els.infoPanel.innerHTML = '';
    return;
  }

  const { left, right } = state.currentPair;
  const resultPhase = state.phase === 'afterCorrect' || state.phase === 'afterWrong';

  const leftLink = resultPhase && left.pageUrl
    ? `<a href="${left.pageUrl}" target="_blank" rel="noopener">Open Wiki for ${left.name}</a>`
    : '';

  const rightLink = resultPhase && right.pageUrl
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

/* --------------------------------------------------
   THEME HANDLING
-------------------------------------------------- */

function applyTheme(lightMode) {
  document.body.classList.toggle('light-theme', lightMode);
}

/* --------------------------------------------------
   HELPERS
-------------------------------------------------- */

function restartAndRenderNewRound() {
  restartGame();
  render();
}

export { getPrimaryImageUrl, getAltImageUrls };
