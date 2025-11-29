
import { getCharacters } from './dataLoader.js';
import { getStrongerCharacter, getTierIndex } from './tierUtils.js';
import { recordRound } from './stats.js';
import { getSettings } from './settings.js';

let gameState = {
  phase: 'loading',
  currentPair: null,
  correctId: null,
  streak: 0,
  usedCharacterKeys: new Set()
};

export function getGameState() {
  return { ...gameState };
}

export function initGameState() {
  gameState = {
    phase: 'inRound',
    currentPair: null,
    correctId: null,
    streak: 0,
    usedCharacterKeys: new Set()
  };
}


function getCharacterKey(c) {
  const name = c.name || c._raw?.Name || '';
  const origin = c.origin || c._raw?.Origin || '';
  return `${name}::${origin}`;
}


function buildFilteredGroups() {
  const settings = getSettings();
  const allChars = getCharacters();
  let pool = allChars;

  // Very Hard: exclude Tier 0 entirely
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

  const groups = new Map();
  for (const c of pool) {
    if (!c.highestTier) continue;
    const key = c.highestTier;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(c);
  }

  return groups;
}


function pickCharacterFromGroup(group) {
  if (!group || !group.length) return null;
  const available = group.filter(c => !gameState.usedCharacterKeys.has(getCharacterKey(c)));
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}


export function startNewRound() {
  const settings = getSettings();
  const groups = buildFilteredGroups();
  const tiers = Array.from(groups.keys()).filter(key => (groups.get(key) || []).length > 0);

  if (tiers.length < 2) {
    gameState.phase = 'error';
    return;
  }

  let candidatePairs = [];

  for (let i = 0; i < tiers.length; i++) {
    for (let j = i + 1; j < tiers.length; j++) {
      const tA = tiers[i];
      const tB = tiers[j];

      const idxA = getTierIndex(tA);
      const idxB = getTierIndex(tB);
      const distance = Math.abs(idxA - idxB);

      if (settings.veryHardMode) {
        
        if (distance === 3) {
          candidatePairs.push([tA, tB]);
        }
      } else {
        
        if (distance > 0) {
          candidatePairs.push([tA, tB]);
        }
      }
    }
  }

  if (settings.veryHardMode && candidatePairs.length === 0) {
    gameState.phase = 'error';
    return;
  }

  let attempts = 0;
  while (attempts < 40) {
    const [tierA, tierB] = candidatePairs[Math.floor(Math.random() * candidatePairs.length)];
    const left = pickCharacterFromGroup(groups.get(tierA));
    const right = pickCharacterFromGroup(groups.get(tierB));

    if (!left || !right) {
      attempts++;
      continue;
    }

    const stronger = getStrongerCharacter(left, right);

    if (!stronger) {
      attempts++;
      continue;
    }

    gameState.currentPair = { left, right };
    gameState.correctId = stronger.id;
    gameState.phase = 'inRound';
    return;
  }

  gameState.phase = 'error';
}

/**
 * Handle card selection
 */
export function handleChoice(selectedId) {
  if (gameState.phase !== 'inRound' || !gameState.currentPair) {
    return { valid: false };
  }

  const { left, right } = gameState.currentPair;
  const correctId = gameState.correctId;

  const selected =
    left.id === selectedId ? left :
    right.id === selectedId ? right :
    null;

  if (!selected) return { valid: false };

  // Mark both characters as used for this run
  gameState.usedCharacterKeys.add(getCharacterKey(left));
  gameState.usedCharacterKeys.add(getCharacterKey(right));

  const correct = selected.id === correctId;

  if (correct) {
    gameState.streak++;
    gameState.phase = 'afterCorrect';
    recordRound(true, gameState.streak);
  } else {
    recordRound(false, gameState.streak);
    gameState.phase = 'afterWrong';
    gameState.streak = 0;
  }

  return {
    valid: true,
    correct,
    selectedId,
    correctId,
    streak: gameState.streak,
    phase: gameState.phase
  };
}

/**
 * Restart run (clears repeats)
 */
export function restartGame() {
  gameState.phase = 'inRound';
  gameState.currentPair = null;
  gameState.correctId = null;
  gameState.streak = 0;
  gameState.usedCharacterKeys = new Set();
  startNewRound();
}
