export type Dim = 'column' | 'layer' | 'bin';
export type ColumnType = 'color' | 'letter' | 'number' | 'icon';
export type LayerType = 'letter' | 'number' | 'icon';
export type BinType = 'letter' | 'number' | 'icon' | 'handed';
export type VDir = 'top' | 'bottom';
export type HDir = 'left' | 'right';
export type BinsPerSection = 1 | 2 | 3 | 4 | 5
  | 'varied-1-2' | 'varied-1-3' | 'varied-1-4' | 'varied-1-5';

export interface Scheme {
  order: [Dim, Dim, Dim];
  columnType: ColumnType;
  layerType: LayerType;
  binType: BinType;
  layerFrom: VDir;
  binFrom: HDir;
  layers: number;            // 3..8
  binsPerSection: BinsPerSection;
}

export type Segment = { kind: 'text'; value: string } | { kind: 'color'; value: string };

export const LETTERS = 'ABCDEFGH';
export const ICONS = ['★','●','▲','■','◆','✚','♥','♦'];
export const COLORS = ['#e0524a','#e08a3c','#e8d24a','#6db86d','#5aa9e0','#9b6ee0'];
// Okabe–Ito based palette, chosen to stay distinguishable for color-vision deficiency.
export const COLORS_CB = ['#d55e00','#56b4e9','#009e73','#f0e442','#0072b2','#cc79a7'];

// Map a canonical COLORS hex to its colorblind-safe equivalent (by index) for display.
export function toPalette(hex: string, colorblind: boolean): string {
  if (!colorblind) return hex;
  const i = COLORS.indexOf(hex);
  return i >= 0 ? COLORS_CB[i] : hex;
}

const HANDED: Record<number, string[]> = {
  1: ['M'], 2: ['L','R'], 3: ['L','M','R'],
  4: ['L','LM','RM','R'], 5: ['L','LM','M','RM','R'],
};
export function handedLabel(leftRank: number, count: number): string {
  return HANDED[count][leftRank - 1];
}

function symbol(type: 'letter'|'number'|'icon', index1: number): string {
  if (type === 'letter') return LETTERS[(index1 - 1) % LETTERS.length];
  if (type === 'icon') return ICONS[(index1 - 1) % ICONS.length];
  return String(index1);
}

export function defaultScheme(): Scheme {
  return {
    order: ['column','layer','bin'],
    columnType: 'color', layerType: 'number', binType: 'number',
    layerFrom: 'top', binFrom: 'left', layers: 4, binsPerSection: 3,
  };
}

export function columnSegment(s: Scheme, column0: number): Segment {
  if (s.columnType === 'color') return { kind: 'color', value: COLORS[column0 % COLORS.length] };
  return { kind: 'text', value: symbol(s.columnType, column0 + 1) };
}

export function layerSegment(s: Scheme, rowFromTop: number, layers: number): Segment {
  const display = s.layerFrom === 'top' ? rowFromTop : layers - rowFromTop + 1;
  return { kind: 'text', value: symbol(s.layerType, display) };
}

export function binSegment(s: Scheme, leftRank: number, count: number): Segment {
  if (s.binType === 'handed') return { kind: 'text', value: handedLabel(leftRank, count) };
  const display = s.binFrom === 'left' ? leftRank : count - leftRank + 1;
  return { kind: 'text', value: symbol(s.binType, display) };
}

export function schemeKey(s: Scheme): string {
  return [
    s.order.join('>'), `c:${s.columnType}`, `l:${s.layerType}`, `b:${s.binType}`,
    `lf:${s.layerFrom}`, `bf:${s.binFrom}`, `L:${s.layers}`, `bps:${s.binsPerSection}`,
  ].join('|');
}

type RNG = () => number;
const pick = <T,>(rng: RNG, arr: T[]): T => arr[Math.floor(rng() * arr.length)];

export function randomizeScheme(rng: RNG): Scheme {
  const orders: Dim[][] = [
    ['column','layer','bin'],['bin','layer','column'],['layer','column','bin'],
    ['column','bin','layer'],['bin','column','layer'],['layer','bin','column'],
  ];
  const bps: BinsPerSection[] = [1,2,3,4,5,'varied-1-2','varied-1-3','varied-1-4','varied-1-5'];
  return {
    order: pick(rng, orders) as [Dim,Dim,Dim],
    columnType: pick(rng, ['color','letter','number','icon'] as ColumnType[]),
    layerType: pick(rng, ['letter','number','icon'] as LayerType[]),
    binType: pick(rng, ['letter','number','icon','handed'] as BinType[]),
    layerFrom: pick(rng, ['top','bottom'] as VDir[]),
    binFrom: pick(rng, ['left','right'] as HDir[]),
    layers: 3 + Math.floor(rng() * 6),
    binsPerSection: pick(rng, bps),
  };
}
