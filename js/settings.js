// js/settings.js
// Handles user settings (theme, difficulty, custom filters).

const SETTINGS_KEY = 'vsrdle_settings';

let settings = {
  theme: 'dark',
  veryHardMode: false,   // pairs within 2 tiers of each other
  customMode: false,     // enable custom series filter
  customSeries: [], 
  lightMode: false

};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    settings = { ...settings, ...parsed };
  } catch (err) {
    console.warn('Failed to load settings:', err);
  }
}

export function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to save settings:', err);
  }
}

export function getSettings() {
  return settings;
}

export function updateSetting(key, value) {
  settings[key] = value;
  saveSettings();
}
