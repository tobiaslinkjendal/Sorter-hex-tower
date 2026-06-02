'use client';
import {
  Rewind, SkipBack, Stop, SkipForward, FastForward, Play,
  ArrowLeft, ArrowDownLeft, ArrowDown, ArrowDownRight, ArrowRight,
} from '@phosphor-icons/react';
import { Segment, HandedPos, toPalette } from '@/lib/scheme';

const MEDIA: Record<string, React.ComponentType<{ size?: number; weight?: 'bold'; color?: string }>> =
  { L: Rewind, LM: SkipBack, M: Stop, RM: SkipForward, R: FastForward, WAIT: Play };
const ARROW: Record<string, React.ComponentType<{ size?: number; weight?: 'bold'; color?: string }>> =
  { L: ArrowLeft, LM: ArrowDownLeft, M: ArrowDown, RM: ArrowDownRight, R: ArrowRight, WAIT: ArrowDown };

const SHAPES: Record<HandedPos, string> = {
  M: 'M2,2 H98 V98 H2 Z',
  L: 'M30,2 H98 V98 H30 L2,50 Z',
  R: 'M2,2 H70 L98,50 L70,98 H2 Z',
  LM: 'M48,2 H98 V98 H48 A38,48 0 0 1 48,2 Z',
  RM: 'M2,2 H52 A38,48 0 0 1 52,98 H2 Z',
  WAIT: 'M2,2 H98 V98 H2 Z',
};

function textOn(hex: string): string {
  const s = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(s.slice(i, i + 2) || '0', 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111' : '#fff';
}

function SegView({ s, color }: { s: Segment; color?: string }) {
  if (s.kind === 'color' || s.kind === 'shape') return null;
  if (s.kind === 'icon') {
    const C = (s.set === 'media' ? MEDIA : ARROW)[s.pos] ?? Stop;
    return <C size={30} weight="bold" color={color} />;
  }
  return <b className="seg" style={color ? { color } : undefined}>{s.value}</b>;
}

function Parts({ segs, color }: { segs: Segment[]; color?: string }) {
  return (
    <>
      {segs.map((s, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SegView s={s} color={color} />
          {i < segs.length - 1 && <span className="sep" style={color ? { color } : undefined}>·</span>}
        </span>
      ))}
    </>
  );
}

export default function AddressPrompt({ segments, colorblind = false }:
  { segments: Segment[]; colorblind?: boolean }) {
  const shapeSeg = segments.find(s => s.kind === 'shape') as Extract<Segment, { kind: 'shape' }> | undefined;
  const colorSeg = segments.find(s => s.kind === 'color') as Extract<Segment, { kind: 'color' }> | undefined;

  if (shapeSeg) {
    const bg = colorSeg ? toPalette(colorSeg.value, colorblind) : '#fff';
    const col = colorSeg ? textOn(bg) : '#111';
    const inner = segments.filter(s => s.kind !== 'shape' && s.kind !== 'color');
    const p = shapeSeg.pos;
    const pad = p === 'L' || p === 'LM' ? '14px 24px 14px 40px'
      : p === 'R' || p === 'RM' ? '14px 40px 14px 24px' : '14px 26px';
    return (
      <span className="addr-shape" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: pad, minWidth: 70, minHeight: 54 }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <path d={SHAPES[p] ?? SHAPES.M} fill={bg} stroke="#111" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        <span style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, color: col }}>
          <Parts segs={inner} color={col} />
        </span>
      </span>
    );
  }

  if (colorSeg) {
    const bg = toPalette(colorSeg.value, colorblind);
    return <div className="addr-box" style={{ background: bg }}><Parts segs={segments.filter(s => s.kind !== 'color')} color={textOn(bg)} /></div>;
  }
  return <div className="addr-box" style={{ background: '#fff' }}><Parts segs={segments} /></div>;
}
