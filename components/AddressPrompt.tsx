import { Segment } from '@/lib/scheme';
export default function AddressPrompt({ segments }: { segments: Segment[] }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#8a92a0', textTransform: 'uppercase', letterSpacing: 1, fontSize: 13 }}>Find</span>
      {segments.map((s, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {s.kind === 'color'
            ? <span style={{ width: 26, height: 26, borderRadius: 6, background: s.value, border: '1px solid #0006' }} />
            : <b style={{ fontSize: 28 }}>{s.value}</b>}
          {i < segments.length - 1 && <span style={{ color: '#56606e', fontSize: 22 }}>·</span>}
        </span>
      ))}
    </div>
  );
}
