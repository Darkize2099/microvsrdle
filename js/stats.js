// js/stats.js
// Tracks basic stats: best streak, total rounds, total correct, etc.

const STATS_KEY = 'vsrdle_stats';

let stats = {
  totalRounds: 0,
  totalCorrectRounds: 0,
  bestStreak: 0,
};

export function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    stats = { ...stats, ...parsed };
  } catch (err) {
    console.warn('Failed to load stats:', err);
  }
}

export function saveStats() {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (err) {
    console.warn('Failed to save stats:', err);
  }
}

export function recordRound(correct, streakAfterRound) {
  stats.totalRounds += 1;
  if (correct) {
    stats.totalCorrectRounds += 1;
    if (streakAfterRound > stats.bestStreak) {
      stats.bestStreak = streakAfterRound;
    }
  }
  saveStats();
}

export function getStats() {
  return stats;
}
