

import { getCharacters } from './dataLoader.js';
import { getSettings } from './settings.js';
import { recordRound } from './stats.js';

let oddGameState = {
  phase: 'loading',        // 'loading' | 'inRound' | 'afterCorrect' | 'afterWrong' | 'error'
  options: [],             
  oddId: null,             
  streak: 0,
  usedCharacterKeys: new Set() 
};

export function getOddGameState() {
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


function getCharacterKey(c) {
  const name = c.name || c._raw?.Name || '';
  const origin = c.origin || c._raw?.Origin || '';
  return `${name}::${origin}`;
}


function buildFilteredPoolForOdd() {
  const settings = getSettings();
  const allChars = getCharacters();

  let pool = allChars;

  // (Consistent with main game) - in Very Hard, exclude Tier 0
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

  // New: dedupe the pool by Name+Origin so we don't get multiple entries
  // with the same character name in a single round.
  const dedupedByKey = new Map();
  for (const c of pool) {
    const key = getCharacterKey(c);
    if (!dedupedByKey.has(key)) {
      dedupedByKey.set(key, c);
    }
  }

  return Array.from(dedupedByKey.values());
}

/**
 * Build a 4-option round:
 * - Choose a "majority" tier that has at least 3 available characters
 * - Choose 3 chars from that tier
 * - Choose 1 char from a different tier
 * All 4 must have distinct Name+Origin.
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
    const tier = c.highestTier;
    if (!groups.has(tier)) {
      groups.set(tier, []);
    }
    groups.get(tier).push(c);
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
  const majorityTier =
    candidateMajorTiers[Math.floor(Math.random() * candidateMajorTiers.length)];
  const majorityGroup = groups.get(majorityTier);

  if (!majorityGroup || majorityGroup.length < 3) {
    console.error('Odd mode: majority group unexpectedly has < 3 characters.');
    oddGameState.phase = 'error';
    return;
  }

  // Randomly pick 3 distinct characters from majorityGroup
  const majorityChars = pickRandomDistinct(majorityGroup, 3);
  if (!majorityChars || majorityChars.length < 3) {
    console.error('Odd mode: failed to pick 3 distinct majority characters.');
    oddGameState.phase = 'error';
    return;
  }

  // Now pick odd-one-out tier: any tier != majorityTier with >=1 char
  const otherTiers = tierKeys.filter(tier => (
    tier !== majorityTier &&
    (groups.get(tier) || []).length > 0
  ));

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

  // Build final options and ensure they still have unique Name+Origin
  let options = shuffleArray([...majorityChars, oddChar]);

  // (Extra safety) remove any accidental same-name collisions.
  const seenKeys = new Set();
  const uniqueOptions = [];
  for (const c of options) {
    const key = getCharacterKey(c);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    uniqueOptions.push(c);
  }

  // If we somehow ended with <4 due to dedup, bail gracefully.
  if (uniqueOptions.length < 4) {
    console.error('Odd mode: could not form 4 unique-name options.');
    oddGameState.phase = 'error';
    return;
  }

  options = uniqueOptions;

  oddGameState.options = options;
  oddGameState.oddId = oddChar.id;
  oddGameState.phase = 'inRound';
}

/**
 * Player clicked one of the 4 cards.
 */
export function handleOddChoice(selectedId) {
  if (
    oddGameState.phase !== 'inRound' ||
    !oddGameState.options ||
    oddGameState.options.length !== 4
  ) {
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
