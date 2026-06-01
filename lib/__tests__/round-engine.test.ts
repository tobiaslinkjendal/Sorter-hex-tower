import { describe, it, expect } from 'vitest';
import { createRound, clickBin, isOver, summarize, isValidRound } from '../round-engine';
import { buildTower } from '../tower-model';
import { defaultScheme } from '../scheme';

const rng = (() => { let s = 5; return () => (s = (s*16807) % 2147483647) / 2147483647; })();
const newRound = () => createRound(buildTower({ ...defaultScheme(), binsPerSection: 2 }, rng), 60000, rng, 0);

describe('round flow', () => {
  it('correct click advances target and scores; wrong click is recorded', () => {
    let r = newRound();
    const wrong = { ...r.target, leftRank: r.target.leftRank === 1 ? 2 : 1 };
    r = clickBin(r, wrong, 500).state;
    const res = clickBin(r, r.target, 1000);
    r = res.state;
    expect(res.correct).toBe(true);
    const sum = summarize(r);
    expect(sum.findsCount).toBe(1);
    expect(sum.wrongClicksTotal).toBe(1);
    expect(sum.score).toBe(1);
  });

  it('isOver true after duration', () => {
    const r = newRound();
    expect(isOver(r, 59999)).toBe(false);
    expect(isOver(r, 60000)).toBe(true);
  });
});

describe('summarize + culling', () => {
  it('accuracy = correct / (correct + wrong)', () => {
    let r = newRound();
    const wrong = { ...r.target, leftRank: r.target.leftRank === 1 ? 2 : 1 };
    r = clickBin(r, wrong, 100).state;
    r = clickBin(r, wrong, 200).state;
    r = clickBin(r, r.target, 300).state;
    const sum = summarize(r);
    expect(sum.accuracy).toBeCloseTo(1/3, 5);
  });
  it('invalid when no finds', () => {
    const r = newRound();
    expect(isValidRound(summarize(r))).toBe(false);
  });
  it('invalid when accuracy below 0.2', () => {
    let r = newRound();
    for (let i = 0; i < 5; i++) {
      const wrong = { ...r.target, leftRank: r.target.leftRank === 1 ? 2 : 1 };
      r = clickBin(r, wrong, i * 100).state;
    }
    r = clickBin(r, r.target, 600).state;
    expect(isValidRound(summarize(r))).toBe(false);
  });
});
