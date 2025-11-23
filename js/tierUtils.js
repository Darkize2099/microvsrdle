// js/tierUtils.js
// Defines the complete subtier ladder and provides helper functions
// for comparing characters based on their highestTier within this ladder.

// Full ordered ladder of subtiers (and Tier 0 at the top)
export const TIER_ORDER = [
  "Tier 0",
  "High 1-A", "1-A", "Low 1-A",
  "High 1-B", "1-B", "1-C", "Low 1-C",
  "2-A", "2-B", "2-C", "Low 2-C",
  "High 3-A", "3-A", "3-B", "3-C",
  "4-A", "4-B", "High 4-C", "4-C", "Low 4-C",
  "High 5-A", "5-A", "5-B", "Low 5-B", "5-C",
  "Tier 6", "High 6-A", "6-A", "High 6-B", "6-B", "Low 6-B", "High 6-C", "6-C",
  "High 7-A", "7-A", "7-B", "Low 7-B", "High 7-C", "7-C", "Low 7-C",
  "8-A", "8-B", "High 8-C", "8-C",
  "9-A", "9-B", "9-C",
  "10-A", "10-B", "10-C",
  "11-A", "11-B", "11-C"
];

// Return the position index of a tier within the TIER_ORDER ladder
export function getTierIndex(tier) {
  return TIER_ORDER.indexOf(tier);
}

// Determine which character is stronger based on highestTier ordering
export function getStrongerCharacter(a, b) {
  const idxA = getTierIndex(a.highestTier);
  const idxB = getTierIndex(b.highestTier);

  if (idxA < 0 || idxB < 0) return null;

  // Lower index means higher power (Tier 0 at index 0)
  return idxA < idxB ? a : b;
}
