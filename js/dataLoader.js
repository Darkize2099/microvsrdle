// js/dataLoader.js
// Loads tier hierarchy, micro origins, and character JSONs.
// Normalizes characters and exposes a shared pool for the game.

import { TIER_ORDER } from './tierUtils.js';

let tierHierarchy = [];
let microOriginsSummary = '';
let characters = [];

// List of tier JSON files inside data/tiers/
const TIER_FILES = [
  'Tier_0.json',
  'Tier_1.json',
  'Tier_2.json',
  'Tier_3.json',
  'Tier_4.json',
  'Tier_5.json',
  'Tier_6.json',
  'Tier_7.json',
  'Tier_8.json',
  'Tier_9.json',
  'Tier_10.json',
  'Tier_11.json'
];

/* ---------- Helpers ---------- */

/**
 * Given an array of tier strings (AllTier from the JSON),
 * pick the strongest one according to TIER_ORDER
 * (lowest index in the ladder).
 */
function computeHighestTier(allTierArray) {
  if (!Array.isArray(allTierArray) || allTierArray.length === 0) return null;

  let best = null;
  let bestIndex = Infinity;

  for (const t of allTierArray) {
    const idx = TIER_ORDER.indexOf(t);
    if (idx >= 0 && idx < bestIndex) {
      best = t;
      bestIndex = idx;
    }
  }
  return best;
}

function buildImageCandidates(raw) {
  const candidates = new Set();

  // Helper to add a filename as images/<filename>
  function addFilename(name) {
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    candidates.add(`images/${trimmed}`);
  }

  // 1) From `source` field
  if (raw.source && raw.source !== 'nan') {
    // plain version
    addFilename(raw.source);

    // encoded version (in case your local file kept %28/%29/etc.)
    const encoded = encodeURIComponent(raw.source);
    if (encoded !== raw.source) {
      addFilename(encoded);
    }
  }

  // 2) From ImageURL (but ONLY used to derive local filenames)
  if (raw.ImageURL && raw.ImageURL !== 'nan') {
    try {
      const urlObj = new URL(raw.ImageURL);
      let lastPart = urlObj.pathname.split('/').pop() || '';

      // Strip query if somehow part of filename
      const qIndex = lastPart.indexOf('?');
      if (qIndex !== -1) {
        lastPart = lastPart.slice(0, qIndex);
      }

      // encoded version straight from URL (has %28, %29, etc.)
      const encodedName = lastPart;
      // decoded, e.g. "(Render).png"
      const decodedName = decodeURIComponent(lastPart);

      addFilename(decodedName);
      if (encodedName !== decodedName) {
        addFilename(encodedName);
      }
    } catch (e) {
      console.warn('ImageURL parsing failed:', raw.ImageURL, e);
    }
  }

  const altImageUrls = Array.from(candidates);
  const primary = altImageUrls.length > 0 ? altImageUrls[0] : null;

  return {
    imageUrl: primary,
    altImageUrls
  };
}



/**
 * Normalize a raw JSON row from any Tier_X.json into
 * the shape used by the game.
 */
function normalizeCharacter(raw) {
  const name = raw.Name || '';
  const origin = raw.Origin || '';

  // mainTier is often present (e.g. "Tier 7"); if not, derive from raw.Tier
  let mainTier = raw.mainTier;
  if (!mainTier && typeof raw.Tier !== 'undefined' && raw.Tier !== null) {
    mainTier = `Tier ${raw.Tier}`;
  }

  const allTiers = Array.isArray(raw.AllTier) ? raw.AllTier : [];
  const highestTier = computeHighestTier(allTiers);

  // Summary key in your JSON can be "Summary" or "summaary"
  const summary = raw.Summary || raw.summaary || '';

  const pageUrl = raw.PageURL || raw.PageUrl || null;

  // Image handling
  const { imageUrl, altImageUrls } = buildImageCandidates(raw);

  const id =
    raw.ID ||
    `${name}-${origin}-${highestTier || mainTier || 'Unknown'}`;

  return {
    id,
    name,
    origin,
    mainTier: mainTier || null,
    highestTier: highestTier || null,
    allTiers,
    summary,
    pageUrl,
    imageUrl,
    altImageUrls,
    sourceFile: raw.source || null,
    remoteImageUrl: raw.ImageURL || null,
    _raw: raw
  };
}

/* ---------- Public loaders ---------- */

/**
 * Load the full tier hierarchy from data/tier_hierachy.txt
 */
export async function loadTierHierarchy() {
  try {
    const res = await fetch('data/tier_hierachy.txt');
    if (!res.ok) {
      console.warn('Failed to load tier_hierachy.txt:', res.status);
      return;
    }
    const text = await res.text();
    tierHierarchy = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  } catch (err) {
    console.error('Error loading tier_hierachy.txt:', err);
  }
}

export function getTierHierarchy() {
  return tierHierarchy;
}

/**
 * Load micro origin summary text (for future filters/modes).
 */
export async function loadMicroOrigins() {
  try {
    const res = await fetch('data/micro_origins_summary.txt');
    if (!res.ok) {
      console.warn('Failed to load micro_origins_summary.txt:', res.status);
      return;
    }
    microOriginsSummary = await res.text();
  } catch (err) {
    console.error('Error loading micro_origins_summary.txt:', err);
  }
}

export function getMicroOriginsSummary() {
  return microOriginsSummary;
}

/**
 * Load all tier JSON files from data/tiers/ and normalize characters.
 */
export async function loadAllCharacters() {
  const loaded = [];

  for (const file of TIER_FILES) {
    const url = `data/tiers/${file}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        // Not all Tier_X.json files may exist; that's okay.
        console.warn(`Skipping ${url} (status ${res.status})`);
        continue;
      }
      const json = await res.json();
      if (!Array.isArray(json)) {
        console.warn(`File ${url} does not contain an array.`);
        continue;
      }

      for (const raw of json) {
        const norm = normalizeCharacter(raw);
        loaded.push(norm);
      }
    } catch (err) {
      console.error('Error loading tier file:', url, err);
    }
  }

  characters = loaded;
  console.log(`Loaded ${characters.length} characters across all tiers.`);
}

/**
 * Get the full character pool for the game.
 */
export function getCharacters() {
  return characters;
}
