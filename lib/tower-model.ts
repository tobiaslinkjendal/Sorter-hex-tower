import { Scheme, Segment, columnSegment, layerSegment, binSegment } from './scheme';

export interface Bin { column: number; rowFromTop: number; leftRank: number; }
export interface Section { column: number; rowFromTop: number; binCount: number; }
export interface Tower { layers: number; sections: Section[]; scheme: Scheme; }
export interface Address { segments: Segment[]; }

type RNG = () => number;

function bandRange(bps: Scheme['binsPerSection']): [number, number] {
  if (typeof bps === 'number') return [bps, bps];
  const max = Number(bps.split('-').pop());
  return [1, max];
}

export function buildTower(scheme: Scheme, rng: RNG): Tower {
  const [lo, hi] = bandRange(scheme.binsPerSection);
  const sections: Section[] = [];
  for (let column = 0; column < 6; column++) {
    for (let rowFromTop = 1; rowFromTop <= scheme.layers; rowFromTop++) {
      const binCount = lo === hi ? lo : lo + Math.floor(rng() * (hi - lo + 1));
      sections.push({ column, rowFromTop, binCount });
    }
  }
  return { layers: scheme.layers, sections, scheme };
}

export function sectionAt(t: Tower, column: number, rowFromTop: number): Section {
  return t.sections.find(s => s.column === column && s.rowFromTop === rowFromTop)!;
}

export function addressOf(t: Tower, bin: Bin): Address {
  const sec = sectionAt(t, bin.column, bin.rowFromTop);
  const segMap = {
    column: columnSegment(t.scheme, bin.column),
    layer: layerSegment(t.scheme, bin.rowFromTop, t.layers),
    bin: binSegment(t.scheme, bin.leftRank, sec.binCount),
  };
  return { segments: t.scheme.order.map(d => segMap[d]) };
}

export function sameBin(a: Bin, b: Bin): boolean {
  return a.column === b.column && a.rowFromTop === b.rowFromTop && a.leftRank === b.leftRank;
}

export function pickTarget(t: Tower, rng: RNG): Bin {
  const sec = t.sections[Math.floor(rng() * t.sections.length)];
  const leftRank = 1 + Math.floor(rng() * sec.binCount);
  return { column: sec.column, rowFromTop: sec.rowFromTop, leftRank };
}
