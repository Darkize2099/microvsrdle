// js/uiOdd.js
// UI for "Odd One Out" mode with updated image handling identical to ui.js.

import { getOddGameState, startNewOddRound, handleOddChoice, restartOddGame } from './gameLogicOdd.js';
import { getStats } from './stats.js';
import { getPrimaryImageUrl, getAltImageUrls } from './ui.js'; // <-- re-use same helpers!

let oddEls = {};

export function initOddUI() {
  oddEls.streakDisplay = document.getElementById('odd-streak-display');

  oddEls.cards = [
    document.getElementById('odd-card-0'),
    document.getElementById('odd-card-1'),
    document.getElementById('odd-card-2'),
    document.getElementById('odd-card-3')
  ];

  oddEls.nextButton = document.getElementById('odd-next-button');
  oddEls.restartButton = document.getElementById('odd-restart-button');

  oddEls.cards.forEach((btn, index) => {
    if (!btn) return;
    btn.addEventListener('click', () => onOddCardClick(index));
  });

  if (oddEls.nextButton) {
    oddEls.nextButton.addEventListener('click', () => {
      startNewOddRound();
      renderOdd();
    });
  }

  if (oddEls.restartButton) {
    oddEls.restartButton.addEventListener('click', () => {
      restartOddGame();
      renderOdd();
    });
  }

  renderOdd();
}

function onOddCardClick(index) {
  const state = getOddGameState();
  if (!state.options || !state.options[index]) return;

  const selectedId = state.options[index].id;
  const result = handleOddChoice(selectedId);
  if (!result.valid) return;

  renderOdd();
}

export function renderOdd() {
  const state = getOddGameState();
  const stats = getStats();

  renderOddStreak(state, stats);
  renderOddCards(state);
  renderOddButtons(state);
}

function renderOddStreak(state, stats) {
  if (!oddEls.streakDisplay) return;

  const total = stats.totalRounds;
  const correct = stats.totalCorrectRounds;
  const best = stats.bestStreak;

  oddEls.streakDisplay.textContent =
    `Odd One Out streak: ${state.streak} | Best: ${best} | Correct: ${correct}/${total}`;
}

function renderOddCards(state) {
  if (!oddEls.cards) return;

  const options = state.options || [];
  const isResultPhase = state.phase === 'afterCorrect' || state.phase === 'afterWrong';

  oddEls.cards.forEach((btn, index) => {
    if (!btn) return;

    const c = options[index];
    if (!c) {
      btn.disabled = true;
      btn.className = 'vs-card';
      btn.textContent = '—';
      return;
    }

    const isOdd = isResultPhase && c.id === state.oddId;

    const baseClass = 'vs-card';
    const extraClass = isResultPhase
      ? (isOdd ? ' vs-card-correct' : ' vs-card-incorrect')
      : '';

    btn.className = `${baseClass}${extraClass}`;
    btn.disabled = state.phase !== 'inRound';

    renderOddCardContent(btn, c, state);
  });
}

function renderOddCardContent(cardElement, character, state) {
  if (!character) {
    cardElement.textContent = '???';
    return;
  }

  const isResultPhase = state.phase === 'afterCorrect' || state.phase === 'afterWrong';

  // IMAGE SELECTION — SAME AS VS MODE
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

  // FALLBACK LOGIC IDENTICAL TO VS MODE
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
          img.src = altList.shift();
        } else {
          img.removeEventListener('error', handleError);
          img.src = 'https://via.placeholder.com/256x256?text=No+Image';
        }
      });
    }
  }
}

function renderOddButtons(state) {
  if (oddEls.nextButton) {
    oddEls.nextButton.hidden = state.phase !== 'afterCorrect';
  }
  if (oddEls.restartButton) {
    oddEls.restartButton.hidden = state.phase !== 'afterWrong';
  }
}
