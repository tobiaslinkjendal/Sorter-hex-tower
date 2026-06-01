import { Segment, toPalette } from '@/lib/scheme';

function textOn(hex: string): string {
  const s = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(s.slice(i, i + 2) || '0', 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#111' : '#fff';
}

function Parts({ segs, color }: { segs: Segment[]; color?: string }) {
  return (
    <>
      {segs.map((s, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <b className="seg" style={color ? { color } : undefined}>{s.value}</b>
          {i < segs.length - 1 && <span className="sep" style={color ? { color } : undefined}>·</span>}
        </span>
      ))}
    </>
  );
}

export default function AddressPrompt({ segments, colorblind = false }:
  { segments: Segment[]; colorblind?: boolean }) {
  const colorSeg = segments.find(s => s.kind === 'color');
  const others = segments.filter(s => s.kind !== 'color');

  if (colorSeg) {
    const bg = toPalette(colorSeg.value, colorblind);
    return (
      <div className="addr-box" style={{ background: bg }}>
        <Parts segs={others} color={textOn(bg)} />
      </div>
    );
  }
  return <div className="addr"><Parts segs={segments} /></div>;
}
