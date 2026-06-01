// Visual-only preferences. Kept OUT of Scheme so they never fragment leaderboards.
export interface Appearance {
  solid: boolean;        // shaded "solid" look vs flat blueprint
  colorblind: boolean;   // swap to the colorblind-safe palette
  headerColor: string;   // header background when column type is NOT color
  binColor: string;      // bin background
}

export function defaultAppearance(): Appearance {
  return { solid: false, colorblind: false, headerColor: '#dddddd', binColor: '#ffffff' };
}

const KEY = 'hex_appearance';
export function loadAppearance(): Appearance {
  if (typeof window === 'undefined') return defaultAppearance();
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...defaultAppearance(), ...JSON.parse(raw) } : defaultAppearance();
  } catch { return defaultAppearance(); }
}
export function saveAppearance(a: Appearance) {
  try { window.localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* ignore */ }
}
