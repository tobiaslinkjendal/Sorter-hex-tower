// Visual / interaction preferences. Kept OUT of Scheme so they never fragment leaderboards.
export type Size = 's' | 'm' | 'l';
export type Placement = 'high' | 'mid' | 'low';

export interface Appearance {
  solid: boolean;        // shaded "solid" look vs flat blueprint
  colorblind: boolean;   // swap to the colorblind-safe palette
  headerColor: string;   // header background when column type is NOT color
  binColor: string;      // bin background (always applies)
  sensitivity: number;   // drag-to-spin multiplier (0.4–2)
  size: Size;            // tower display size
  placement: Placement;  // tower vertical placement
  sound: boolean;        // sound effects on/off
  durationS: number;     // round length in seconds (30/60/90)
  scrollRotate: boolean; // use the scroll wheel to rotate
  scrollDir: 'up' | 'down'; // which scroll direction spins which way
  autospin: boolean;     // slowly spin the tower while idle on the home screen
}

export function defaultAppearance(): Appearance {
  return {
    solid: false, colorblind: false, headerColor: '#dddddd', binColor: '#ffffff',
    sensitivity: 1, size: 'm', placement: 'mid', sound: false, durationS: 60,
    scrollRotate: false, scrollDir: 'up', autospin: true,
  };
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
