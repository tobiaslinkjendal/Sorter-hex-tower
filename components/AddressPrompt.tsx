import { Segment, toPalette } from '@/lib/scheme';

export default function AddressPrompt({ segments, label = 'Find', colorblind = false }:
  { segments: Segment[]; label?: string; colorblind?: boolean }) {
  return (
    <div className="prompt">
      <span className="label-up">{label}</span>
      {segments.map((s, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {s.kind === 'color'
            ? <span className="chip" style={{ background: toPalette(s.value, colorblind) }} />
            : <b className="seg">{s.value}</b>}
          {i < segments.length - 1 && <span className="sep">·</span>}
        </span>
      ))}
    </div>
  );
}
