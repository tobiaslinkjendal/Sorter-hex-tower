'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Scheme, orderCode, cardSignature } from '@/lib/scheme';
import { StatCard, BarChart, Trend, Datum } from '@/components/charts';

interface URound { created_at: string; scheme: Scheme; scheme_key: string; duration_s: number; finds_count: number; score: number; accuracy: number; wrong_clicks_total: number }
const msToS = (v: number) => (v / 1000).toFixed(2) + 's';
const pct = (v: number) => v.toFixed(0) + '%';
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const findMs = (r: URound) => (r.finds_count > 0 ? r.duration_s * 1000 / r.finds_count : 0);

export default function UserPage() {
  const [name, setName] = useState('');
  const [rounds, setRounds] = useState<URound[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const n = new URLSearchParams(window.location.search).get('name') ?? '';
    setName(n);
    if (!n) { setLoading(false); return; }
    fetch(`/api/user?name=${encodeURIComponent(n)}`).then(r => r.json())
      .then(d => { setRounds(d.rounds ?? []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const windows = useMemo(() => {
    const mk = (n: number | null) => {
      const slice = n ? rounds.slice(-n) : rounds;
      return { label: n ? `last ${n}` : 'all', games: slice.length, find: avg(slice.map(findMs)), acc: avg(slice.map(r => r.accuracy)) * 100 };
    };
    return [mk(5), mk(10), mk(30), mk(50), mk(null)];
  }, [rounds]);

  const byLayout = useMemo<Datum[]>(() => {
    const m = new Map<string, number>();
    for (const r of rounds) { const k = `L${r.scheme.layers}/${r.scheme.binsPerSection}`; m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [rounds]);

  const byScheme = useMemo(() => {
    const m = new Map<string, { n: number; best: number; desc: string }>();
    for (const r of rounds) {
      const e = m.get(r.scheme_key) ?? { n: 0, best: 0, desc: `${orderCode(r.scheme)} · ${cardSignature(r.scheme)} · L${r.scheme.layers}/${r.scheme.binsPerSection}` };
      e.n++; e.best = Math.max(e.best, r.score); m.set(r.scheme_key, e);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [rounds]);

  if (loading) return <main className="an"><p className="hint">Loading…</p></main>;
  if (!name) return <main className="an"><p className="hint">No player selected.</p><Link href="/analytics">← analytics</Link></main>;
  if (rounds.length === 0) return <main className="an"><h1>{name}</h1><p className="hint">No valid rounds for this player.</p><Link href="/analytics">← analytics</Link></main>;

  const best = Math.max(...rounds.map(r => r.score));

  return (
    <main className="an">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <h1 style={{ margin: 0 }}>{name}</h1>
        <span><Link href="/analytics">analytics</Link> · <Link href="/">game</Link></span>
      </div>

      <div className="stat-cards">
        <StatCard label="games" value={String(rounds.length)} />
        <StatCard label="best score" value={String(best)} />
        <StatCard label="avg score" value={avg(rounds.map(r => r.score)).toFixed(1)} />
        <StatCard label="avg accuracy" value={pct(avg(rounds.map(r => r.accuracy)) * 100)} />
        <StatCard label="avg find time" value={msToS(avg(rounds.map(findMs)))} />
      </div>

      <h2 style={{ margin: '8px 0 10px', fontSize: 15 }}>Recent form</h2>
      <div className="card-box" style={{ marginBottom: 14 }}>
        <div className="lb-head" style={{ gridTemplateColumns: '1fr auto auto auto' }}><span>window</span><span>games</span><span>find time</span><span>accuracy</span></div>
        {windows.map((w, i) => (
          <div className="lb-row" key={i} style={{ gridTemplateColumns: '1fr auto auto auto' }}>
            <span>{w.label}</span><span className="mono">{w.games}</span><span className="mono">{msToS(w.find)}</span><span className="mono">{pct(w.acc)}</span>
          </div>
        ))}
      </div>

      <div className="an-grid">
        <Trend title="Find time over games (lower = better)" points={rounds.map(findMs)} fmt={msToS} />
        <Trend title="Accuracy over games" points={rounds.map(r => r.accuracy * 100)} fmt={pct} />
        <Trend title="Score over games" points={rounds.map(r => r.score)} fmt={v => v.toFixed(0)} />
        <BarChart title="Runs per layout" data={byLayout} fmt={v => String(v)} />
      </div>

      <h2 style={{ margin: '18px 0 10px', fontSize: 15 }}>Per scheme</h2>
      <div className="card-box">
        <div className="lb-head" style={{ gridTemplateColumns: '1fr auto auto' }}><span>scheme</span><span>runs</span><span>best</span></div>
        {byScheme.map((s, i) => (
          <div className="lb-row" key={i} style={{ gridTemplateColumns: '1fr auto auto' }}>
            <span className="lb-name" title={s.desc}>{s.desc}</span><span className="mono">{s.n}</span><span className="mono">{s.best}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
