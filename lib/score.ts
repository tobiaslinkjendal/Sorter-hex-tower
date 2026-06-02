import { Scheme } from './scheme';

// Difficulty weights for "bins per section", in the intended ramp:
// 1 < 2 < 3 < *1-2 < 4 < *1-3 < 5 < *1-4 < *1-5  (varied is harder than a fixed
// count of similar average because the layout can't be trusted — you must look).
export const BIN_DIFF: Record<string, number> = {
  '1': 1.0, '2': 1.6, '3': 2.2, 'varied-1-2': 2.6, '4': 3.0,
  'varied-1-3': 3.5, '5': 4.0, 'varied-1-4': 4.6, 'varied-1-5': 5.2,
};

// Layers ramp is gentle (logarithmic): 3→1.58, 4→2, 5→2.32, 6→2.58, 7→2.81, 8→3.
export const layerDiff = (layers: number) => Math.log2(layers);

export const difficulty = (s: Scheme) => layerDiff(s.layers) * (BIN_DIFF[String(s.binsPerSection)] ?? 1);

// Final score used for leaderboards & comparisons.
// rate = finds normalized to 60s; scaled by tower difficulty; penalized by accuracy.
export function computeScore(findsCount: number, durationS: number, accuracy: number, scheme: Scheme): number {
  if (findsCount <= 0) return 0;
  const rate60 = (findsCount * 60) / durationS;
  return Math.round(rate60 * difficulty(scheme) * accuracy);
}
