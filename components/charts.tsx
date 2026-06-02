'use client';
import React from 'react';

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-box" style={{ padding: '12px 14px' }}>
      <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div className="label-up">{label}</div>
    </div>
  );
}

export interface Datum { label: string; value: number; n?: number }

export function BarChart({ title, data, fmt }: { title: string; data: Datum[]; fmt: (v: number) => string }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div className="card-box">
      <h3>{title}</h3>
      {data.length === 0 && <p className="hint">No data.</p>}
      {data.map((d, i) => (
        <div className="bar-row" key={i} title={d.n != null ? `${d.n} rounds` : ''}>
          <span className="bar-lab">{d.label}</span>
          <span className="bar-track"><span className="bar-fill" style={{ width: `${(d.value / max) * 100}%` }} /></span>
          <span className="mono" style={{ textAlign: 'right' }}>{fmt(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function Histogram({ title, values, bins = 12, fmt }: { title: string; values: number[]; bins?: number; fmt: (v: number) => string }) {
  if (values.length === 0) return <div className="card-box"><h3>{title}</h3><p className="hint">No data.</p></div>;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1, w = span / bins;
  const counts = new Array(bins).fill(0);
  for (const v of values) counts[Math.min(bins - 1, Math.floor((v - min) / w))]++;
  const cmax = Math.max(...counts);
  return (
    <div className="card-box">
      <h3>{title}</h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 110 }}>
        {counts.map((c, i) => (
          <div key={i} title={`${fmt(min + i * w)}–${fmt(min + (i + 1) * w)} · ${c}`}
            style={{ flex: 1, background: '#111', height: `${(c / cmax) * 100}%`, minHeight: c ? 2 : 0 }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }} className="hint">
        <span>{fmt(min)}</span><span>{fmt(max)}</span>
      </div>
    </div>
  );
}

export function Trend({ title, points, fmt }: { title: string; points: number[]; fmt: (v: number) => string }) {
  if (points.length < 2) return <div className="card-box"><h3>{title}</h3><p className="hint">Need at least 2 games.</p></div>;
  const min = Math.min(...points), max = Math.max(...points), span = max - min || 1;
  const W = 300, H = 90;
  const pts = points.map((p, i) => `${(i / (points.length - 1)) * W},${H - ((p - min) / span) * H}`).join(' ');
  return (
    <div className="card-box">
      <h3>{title}</h3>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 100 }} preserveAspectRatio="none">
        <polyline points={pts} fill="none" stroke="#111" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between' }} className="hint">
        <span>first {fmt(points[0])}</span><span>latest {fmt(points[points.length - 1])}</span>
      </div>
    </div>
  );
}

export function Heatmap({ title, rows, cols, values, fmt }:
  { title: string; rows: string[]; cols: string[]; values: (number | null)[][]; fmt: (v: number) => string }) {
  const flat = values.flat().filter((v): v is number => v != null);
  const min = flat.length ? Math.min(...flat) : 0, max = flat.length ? Math.max(...flat) : 1;
  const span = max - min || 1;
  return (
    <div className="card-box">
      <h3>{title}</h3>
      {flat.length === 0 ? <p className="hint">No data.</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: `40px repeat(${cols.length}, 1fr)`, gap: 2 }}>
          <span />
          {cols.map(c => <span key={c} className="hint" style={{ textAlign: 'center' }}>{c}</span>)}
          {rows.map((r, ri) => (
            <React.Fragment key={r}>
              <span className="hint" style={{ alignSelf: 'center' }}>{r}</span>
              {cols.map((_, ci) => {
                const v = values[ri][ci];
                if (v == null) return <span key={ci} className="hm-cell" style={{ background: '#fafafa', color: '#ccc' }}>·</span>;
                const t = (v - min) / span;
                const g = Math.round(245 - t * 215);
                return <span key={ci} className="hm-cell" style={{ background: `rgb(${g},${g},${g})`, color: g < 120 ? '#fff' : '#111' }}>{fmt(v)}</span>;
              })}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
