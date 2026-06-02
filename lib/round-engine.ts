import { Bin, Tower, pickTarget, sameBin, addressOf } from './tower-model';

type RNG = () => number;

export interface ClickRecord { bin: Bin; isCorrect: boolean; timeMs: number; }
export interface FindRecord {
  target: Bin; targetDisplay: string; startMs: number; endMs: number; wrongClicks: number;
}
export interface Round {
  tower: Tower; durationMs: number; startMs: number; rng: RNG;
  target: Bin; targetDisplay: string; findStartMs: number;
  finds: FindRecord[]; clicks: ClickRecord[]; currentWrong: number;
}
export interface Summary {
  findsCount: number; score: number; accuracy: number; wrongClicksTotal: number;
  avgTimeMs: number; finds: FindRecord[]; clicks: ClickRecord[];
}

function displayString(tower: Tower, bin: Bin): string {
  return addressOf(tower, bin).segments
    .map(s => (s.kind === 'color' ? `#${s.value.slice(1)}` : s.value)).join(' · ');
}

export function createRound(tower: Tower, durationMs: number, rng: RNG, nowMs: number): Round {
  const target = pickTarget(tower, rng);
  return {
    tower, durationMs, startMs: nowMs, rng,
    target, targetDisplay: displayString(tower, target), findStartMs: nowMs,
    finds: [], clicks: [], currentWrong: 0,
  };
}

export function isOver(r: Round, nowMs: number): boolean {
  return nowMs - r.startMs >= r.durationMs;
}

export function clickBin(r: Round, clicked: Bin, nowMs: number): { state: Round; correct: boolean } {
  const correct = sameBin(clicked, r.target);
  const clicks = [...r.clicks, { bin: clicked, isCorrect: correct, timeMs: nowMs - r.startMs }];
  if (!correct) {
    return { state: { ...r, clicks, currentWrong: r.currentWrong + 1 }, correct: false };
  }
  const finds = [...r.finds, {
    target: r.target, targetDisplay: r.targetDisplay,
    startMs: r.findStartMs, endMs: nowMs, wrongClicks: r.currentWrong,
  }];
  let next = pickTarget(r.tower, r.rng);   // never repeat the same address back-to-back
  for (let guard = 0; guard < 30 && sameBin(next, r.target); guard++) next = pickTarget(r.tower, r.rng);
  return {
    state: {
      ...r, clicks, finds, currentWrong: 0,
      target: next, targetDisplay: displayString(r.tower, next), findStartMs: nowMs,
    },
    correct: true,
  };
}

export function summarize(r: Round): Summary {
  // Count only clicks that belong to COMPLETED finds, so trailing wrong clicks on
  // an unfinished final target (when time runs out) don't skew accuracy. This keeps
  // the result panel, the saved row, and the stored clicks consistent.
  const findsCount = r.finds.length;
  const wrongClicksTotal = r.finds.reduce((a, f) => a + f.wrongClicks, 0);
  const correct = findsCount;
  const totalClicks = correct + wrongClicksTotal;
  const accuracy = totalClicks === 0 ? 0 : correct / totalClicks;
  const avgTimeMs = findsCount === 0 ? 0
    : r.finds.reduce((a, f) => a + (f.endMs - f.startMs), 0) / findsCount;
  return { findsCount, score: findsCount, accuracy, wrongClicksTotal, avgTimeMs,
           finds: r.finds, clicks: r.clicks };
}

export function isValidRound(s: Summary): boolean {
  if (s.findsCount < 1) return false;
  if (s.accuracy < 0.2) return false;
  return true;
}
