import { describe, it, expect } from 'vitest';
import { buildTower, sectionAt, addressOf, sameBin, pickTarget } from '../tower-model';
import { defaultScheme } from '../scheme';

const seededRng = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

describe('buildTower', () => {
  it('has 6 columns x layers sections, fixed bins per section', () => {
    const t = buildTower({ ...defaultScheme(), layers: 5, binsPerSection: 3 }, seededRng(1));
    expect(t.layers).toBe(5);
    expect(t.sections.length).toBe(6 * 5);
    expect(t.sections.every(s => s.binCount === 3)).toBe(true);
  });
  it('varied bins stay within the band and are stable for a seed', () => {
    const t1 = buildTower({ ...defaultScheme(), binsPerSection: 'varied-1-4' }, seededRng(7));
    const t2 = buildTower({ ...defaultScheme(), binsPerSection: 'varied-1-4' }, seededRng(7));
    expect(t1.sections.map(s => s.binCount)).toEqual(t2.sections.map(s => s.binCount));
    expect(t1.sections.every(s => s.binCount >= 1 && s.binCount <= 4)).toBe(true);
  });
});

describe('addressOf', () => {
  it('orders segments per scheme.order', () => {
    const s = { ...defaultScheme(), order: ['bin','layer','column'] as any,
                columnType: 'letter' as const, layerType: 'number' as const, binType: 'number' as const };
    const t = buildTower(s, seededRng(2));
    const addr = addressOf(t, { column: 0, rowFromTop: 1, leftRank: 1 });
    // column ids run A→F, so physical column 0 displays as 'F'
    expect(addr.segments.map(x => x.value ?? x.kind)).toEqual(['1','1','F']);
  });
});

describe('sameBin', () => {
  it('identity match on canonical coords', () => {
    const a = { column: 1, rowFromTop: 2, leftRank: 1 };
    expect(sameBin(a, { ...a })).toBe(true);
    expect(sameBin(a, { ...a, leftRank: 2 })).toBe(false);
  });
});

describe('pickTarget', () => {
  it('returns a bin that exists in the tower', () => {
    const t = buildTower({ ...defaultScheme(), binsPerSection: 'varied-1-5' }, seededRng(3));
    const tgt = pickTarget(t, seededRng(9));
    const sec = sectionAt(t, tgt.column, tgt.rowFromTop);
    expect(tgt.leftRank).toBeGreaterThanOrEqual(1);
    expect(tgt.leftRank).toBeLessThanOrEqual(sec.binCount);
  });
});
