import { describe, it, expect } from 'vitest';
import {
  defaultScheme, randomizeScheme, schemeKey,
  columnSegment, layerSegment, binSegment, handedLabel, LETTERS, ICONS, COLORS,
} from '../scheme';

describe('handedLabel', () => {
  it('maps count->symmetric labels by left rank', () => {
    expect(handedLabel(1, 1)).toBe('M');
    expect([handedLabel(1,2), handedLabel(2,2)]).toEqual(['L','R']);
    expect([1,2,3].map(i => handedLabel(i,3))).toEqual(['L','M','R']);
    expect([1,2,3,4].map(i => handedLabel(i,4))).toEqual(['L','LM','RM','R']);
    expect([1,2,3,4,5].map(i => handedLabel(i,5))).toEqual(['L','LM','M','RM','R']);
  });
});

describe('segments respect type + direction', () => {
  const s = defaultScheme();
  it('column color segment returns a hex color', () => {
    const seg = columnSegment({ ...s, columnType: 'color' }, 0);
    expect(seg.kind).toBe('color');
    expect(seg.value).toBe(COLORS[0]);
  });
  it('layer number honors layerFrom=bottom', () => {
    const top = layerSegment({ ...s, layerType: 'number', layerFrom: 'top' }, 1, 5);
    const bot = layerSegment({ ...s, layerType: 'number', layerFrom: 'bottom' }, 1, 5);
    expect(top.value).toBe('1');
    expect(bot.value).toBe('5');
  });
  it('bin letter honors binFrom=right', () => {
    const left = binSegment({ ...s, binType: 'letter', binFrom: 'left' }, 1, 3);
    const right = binSegment({ ...s, binType: 'letter', binFrom: 'right' }, 1, 3);
    expect(left.value).toBe('A');
    expect(right.value).toBe('C');
  });
  it('bin handed ignores binFrom (absolute position)', () => {
    const a = binSegment({ ...s, binType: 'handed', binFrom: 'left' }, 1, 3);
    const b = binSegment({ ...s, binType: 'handed', binFrom: 'right' }, 1, 3);
    expect(a.value).toBe('L');
    expect(b.value).toBe('L');
  });
});

describe('schemeKey is stable + order-sensitive', () => {
  it('same scheme -> same key, different order -> different key', () => {
    const s = defaultScheme();
    expect(schemeKey(s)).toBe(schemeKey({ ...s }));
    expect(schemeKey(s)).not.toBe(schemeKey({ ...s, order: ['bin','layer','column'] }));
  });
});

describe('randomizeScheme', () => {
  it('produces a valid scheme deterministically from a seed', () => {
    let n = 0; const rng = () => [0.1,0.9,0.3,0.7,0.5,0.2,0.8,0.4][n++ % 8];
    const r = randomizeScheme(rng);
    expect(r.order.length).toBe(3);
    expect(new Set(r.order).size).toBe(3);
    expect(r.layers).toBeGreaterThanOrEqual(3);
    expect(r.layers).toBeLessThanOrEqual(8);
  });
});
