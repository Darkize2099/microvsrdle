// js/gameLogicOdd.js
// "Odd One Out" mode:
// Show 4 characters. 3 have the same highestTier, 1 has a different highestTier.
// Player must pick the different one.
// No repeats per run by (Name + Origin).

import { getCharacters } from './dataLoader.js';
import { getSettings } from './settings.js';
import { recordRound } from './stats.js';

let oddGameState = {
  phase: 'loading',        // 'loading' | 'inRound' | 'afterCorrect' | 'afterWrong' | 'error'
  options: [],             // array of 4 characters
  oddId: null,             // the ID of the "different" one
  streak: 0,
  usedCharacterKeys: new Set() // Name+Origin used this run
};

export function getOddGameState() {
  // shallow copy; usedCharacterKeys omitted intentionally
  return {
    phase: oddGameState.phase,
    options: oddGameState.options,
    oddId: oddGameState.oddId,
    streak: oddGameState.streak
  };
}

export function initOddGameState() {
  oddGameState = {
    phase: 'inRound',
    options: [],
    oddId: null,
    streak: 0,
    usedCharacterKeys: new Set()
  };
}

/**
 * Build a stable key so duplicate tier entries for the same character
 * count as "the same character" for no-repeats.
 */
function getCharacterKey(c) {
  const name = c.name || c._raw?.Name || '';
  const origin = c.origin || c._raw?.Origin || '';
  return `${name}::${origin}`;
}

/**
 * Apply custom filters (and Very Hard Tier 0 exclusion, if you want it consistent).
 */
function buildFilteredPoolForOdd() {
  const settings = getSettings();
  const allChars = getCharacters();

  let pool = allChars;

  // (Optional, but consistent with main game) - in Very Hard, exclude Tier 0
  if (settings.veryHardMode) {
    pool = pool.filter(c => c.highestTier !== 'Tier 0');
  }

  // Custom series filter
  if (
    settings.customMode &&
    Array.isArray(settings.customSeries) &&
    settings.customSeries.length > 0
  ) {
    const allowed = new Set(settings.customSeries);
    pool = pool.filter(c => allowed.has(c.origin));
  }

  // Enforce no repeats in this run by Name+Origin
  pool = pool.filter(c => !oddGameState.usedCharacterKeys.has(getCharacterKey(c)));

  return pool;
}

/**
 * Build a 4-option round:
 * - Choose a "majority" tier that has at least 3 available characters
 * - Choose 3 chars from that tier
 * - Choose 1 char from a different tier
 */
export function startNewOddRound() {
  const pool = buildFilteredPoolForOdd();

  if (pool.length < 4) {
    console.error('Odd mode: not enough characters left to form a round.');
    oddGameState.phase = 'error';
    return;
  }

  // Group by highestTier
  const groups = new Map();
  for (const c of pool) {
    if (!c.highestTier) continue;
    const key = c.highestTier;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(c);
  }

  const tierKeys = Array.from(groups.keys());
  if (tierKeys.length < 2) {
    console.error('Odd mode: need at least 2 different tiers to form odd-one-out.');
    oddGameState.phase = 'error';
    return;
  }

  // Find candidate "majority" tiers that have at least 3 chars AND
  // there exists at least one other tier with >= 1 char.
  const candidateMajorTiers = tierKeys.filter(tier => {
    const arr = groups.get(tier) || [];
    if (arr.length < 3) return false;

    // Is there at least one other tier with >= 1 char?
    return tierKeys.some(otherTier => {
      if (otherTier === tier) return false;
      const otherArr = groups.get(otherTier) || [];
      return otherArr.length >= 1;
    });
  });

  if (candidateMajorTiers.length === 0) {
    console.error('Odd mode: no tier has 3+ chars with a different tier available.');
    oddGameState.phase = 'error';
    return;
  }

  // Pick majority tier randomly
  const majorityTier = candidateMajorTiers[Math.floor(Math.random() * candidateMajorTiers.length)];
  const majorityGroup = groups.get(majorityTier);

  // Randomly pick 3 distinct characters from majorityGroup
  if (majorityGroup.length < 3) {
    // Shouldn't happen due to filter above, but guard anyway.
    console.error('Odd mode: majority group unexpectedly has < 3 characters.');
    oddGameState.phase = 'error';
    return;
  }

  const majorityChars = pickRandomDistinct(majorityGroup, 3);
  if (!majorityChars || majorityChars.length < 3) {
    console.error('Odd mode: failed to pick 3 distinct majority characters.');
    oddGameState.phase = 'error';
    return;
  }

  // Now pick odd-one-out tier: any tier != majorityTier with >=1 char
  const otherTiers = tierKeys.filter(tier => tier !== majorityTier && (groups.get(tier) || []).length > 0);
  if (otherTiers.length === 0) {
    console.error('Odd mode: no different tier for odd-one-out.');
    oddGameState.phase = 'error';
    return;
  }

  const oddTier = otherTiers[Math.floor(Math.random() * otherTiers.length)];
  const oddGroup = groups.get(oddTier) || [];
  if (oddGroup.length === 0) {
    console.error('Odd mode: chosen oddTier has no characters.');
    oddGameState.phase = 'error';
    return;
  }

  const oddChar = oddGroup[Math.floor(Math.random() * oddGroup.length)];

  // Combine and shuffle the 4 options
  const options = shuffleArray([...majorityChars, oddChar]);

  oddGameState.options = options;
  oddGameState.oddId = oddChar.id;
  oddGameState.phase = 'inRound';
}

/**
 * Player clicked one of the 4 cards.
 */
export function handleOddChoice(selectedId) {
  if (oddGameState.phase !== 'inRound' || !oddGameState.options || oddGameState.options.length !== 4) {
    return { valid: false, message: 'Not ready for selection.' };
  }

  const selected = oddGameState.options.find(c => c.id === selectedId);
  if (!selected) {
    return { valid: false, message: 'Unknown character selected.' };
  }

  const correct = selectedId === oddGameState.oddId;

  // Mark all 4 characters as used for this run (by Name+Origin)
  for (const c of oddGameState.options) {
    oddGameState.usedCharacterKeys.add(getCharacterKey(c));
  }

  if (correct) {
    oddGameState.streak += 1;
    oddGameState.phase = 'afterCorrect';
    recordRound(true, oddGameState.streak);
  } else {
    recordRound(false, oddGameState.streak);
    oddGameState.phase = 'afterWrong';
    oddGameState.streak = 0;
  }

  return {
    valid: true,
    correct,
    selectedId,
    oddId: oddGameState.oddId,
    options: oddGameState.options,
    streak: oddGameState.streak,
    phase: oddGameState.phase
  };
}

/**
 * Reset odd-mode run.
 */
export function restartOddGame() {
  oddGameState.phase = 'inRound';
  oddGameState.options = [];
  oddGameState.oddId = null;
  oddGameState.streak = 0;
  oddGameState.usedCharacterKeys = new Set();
  startNewOddRound();
}

/* ---------- Utilities ---------- */

function pickRandomDistinct(arr, count) {
  if (arr.length < count) return null;
  const copy = [...arr];
  const picked = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    picked.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return picked;
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
