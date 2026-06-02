'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Scheme } from '@/lib/scheme';
import { StatCard, BarChart, Histogram, Heatmap, Datum } from '@/components/charts';

interface RoundRow {
  id: string; name: string | null; scheme: Scheme; scheme_key: string;
  duration_s: number; finds_count: number; score: number; accuracy: number; wrong_clicks_total: number; valid: boolean;
}
interface FindRow { id: string; round_id: string; seq: number; target_column: number; target_layer: number; target_bin: number; time_ms: number; wrong_clicks: number }
interface ClickRow { find_id: string; clicked_column: number; clicked_layer: number; clicked_bin: number; is_correct: boolean; time_ms: number }

type Metric = 'findtime' | 'accuracy' | 'score';
const isNum = (s: string) => /^\d+$/.test(s);
const msToS = (v: number) => (v / 1000).toFixed(2) + 's';
const pct = (v: number) => v.toFixed(0) + '%';

const FACETS: { key: string; label: string; get: (r: RoundRow) => string }[] = [
  { key: 'columnType', label: 'Column type', get: r => r.scheme.columnType },
  { key: 'layerType', label: 'Layer type', get: r => r.scheme.layerType },
  { key: 'binType', label: 'Bin type', get: r => r.scheme.binType },
  { key: 'order', label: 'Address order', get: r => r.scheme.order.join('→') },
  { key: 'layers', label: 'Layers', get: r => String(r.scheme.layers) },
  { key: 'binsPerSection', label: 'Bins / section', get: r => String(r.scheme.binsPerSection) },
  { key: 'layerFrom', label: 'Layers from', get: r => r.scheme.layerFrom },
  { key: 'binFrom', label: 'Bins from', get: r => r.scheme.binFrom },
  { key: 'valid', label: 'Validity', get: r => (r.valid ? 'valid' : 'culled') },
];

function groupAvg<T>(items: T[], key: (t: T) => string, val: (t: T) => number | null): Datum[] {
  const m = new Map<string, { s: number; n: number; cnt: number }>();
  for (const it of items) {
    const k = key(it), v = val(it);
    const e = m.get(k) ?? { s: 0, n: 0, cnt: 0 };
    e.cnt++; if (v != null) { e.s += v; e.n++; }
    m.set(k, e);
  }
  const out = [...m.entries()].map(([label, e]) => ({ label, value: e.n ? e.s / e.n : 0, n: e.cnt }));
  out.sort((a, b) => (isNum(a.label) && isNum(b.label) ? +a.label - +b.label : b.value - a.value));
  return out;
}
function buildHeat<T>(items: T[], rowOf: (t: T) => number, colOf: (t: T) => number, valOf: (t: T) => number) {
  const rs = [...new Set(items.map(rowOf))].sort((a, b) => a - b);
  const cs = [...new Set(items.map(colOf))].sort((a, b) => a - b);
  const sum = new Map<string, { s: number; n: number }>();
  for (const it of items) { const k = rowOf(it) + ',' + colOf(it); const e = sum.get(k) ?? { s: 0, n: 0 }; e.s += valOf(it); e.n++; sum.set(k, e); }
  const values = rs.map(r => cs.map(c => { const e = sum.get(r + ',' + c); return e ? e.s / e.n : null; }));
  return { rows: rs.map(String), cols: cs.map(String), values };
}
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export default function AnalyticsPage() {
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [finds, setFinds] = useState<FindRow[]>([]);
  const [clicks, setClicks] = useState<ClickRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [metric, setMetric] = useState<Metric>('findtime');

  const router = useRouter();
  useEffect(() => {
    fetch('/api/analytics').then(r => r.json()).then(d => {
      // Drop zero-score rounds — those are aborted/broken and shouldn't count.
      setRounds((d.rounds ?? []).filter((r: RoundRow) => r.score > 0));
      setFinds(d.finds ?? []); setClicks(d.clicks ?? []); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const options = useMemo(() => {
    const o: Record<string, string[]> = {};
    for (const f of FACETS) o[f.key] = [...new Set(rounds.map(f.get))].sort((a, b) => (isNum(a) && isNum(b) ? +a - +b : a.localeCompare(b)));
    return o;
  }, [rounds]);

  const fRounds = useMemo(() => rounds.filter(r => FACETS.every(f => !sel[f.key] || sel[f.key] === 'any' || f.get(r) === sel[f.key])), [rounds, sel]);
  const roundIds = useMemo(() => new Set(fRounds.map(r => r.id)), [fRounds]);
  const fFinds = useMemo(() => finds.filter(f => roundIds.has(f.round_id)), [finds, roundIds]);
  const findToRound = useMemo(() => { const m = new Map<string, string>(); for (const f of finds) m.set(f.id, f.round_id); return m; }, [finds]);
  const fClicks = useMemo(() => clicks.filter(c => roundIds.has(findToRound.get(c.find_id) ?? '')), [clicks, roundIds, findToRound]);

  const metricVal = (r: RoundRow): number | null =>
    metric === 'findtime' ? (r.finds_count > 0 ? r.duration_s * 1000 / r.finds_count : null)
      : metric === 'accuracy' ? r.accuracy * 100 : r.score;
  const metricFmt = metric === 'findtime' ? msToS : metric === 'accuracy' ? pct : (v: number) => v.toFixed(1);
  const metricName = metric === 'findtime' ? 'avg find time' : metric === 'accuracy' ? 'accuracy' : 'score';

  const players = new Set(fRounds.map(r => r.name ?? 'anon')).size;
  const avgFind = avg(fRounds.filter(r => r.finds_count > 0).map(r => r.duration_s * 1000 / r.finds_count));
  const validPct = fRounds.length ? (fRounds.filter(r => r.valid).length / fRounds.length) * 100 : 0;

  // best / worst schemes by avg find time (>=2 rounds)
  const schemeAgg = useMemo(() => {
    const m = new Map<string, { sumT: number; nT: number; acc: number[]; n: number; desc: string; scheme: Scheme }>();
    for (const r of fRounds) {
      const e = m.get(r.scheme_key) ?? { sumT: 0, nT: 0, acc: [], n: 0, scheme: r.scheme, desc: `${r.scheme.order.map(d => d[0].toUpperCase()).join('')} · ${r.scheme.columnType}/${r.scheme.layerType}/${r.scheme.binType} · L${r.scheme.layers}/${r.scheme.binsPerSection}` };
      if (r.finds_count > 0) { e.sumT += r.duration_s * 1000 / r.finds_count; e.nT++; }
      e.acc.push(r.accuracy); e.n++; m.set(r.scheme_key, e);
    }
    return [...m.values()].filter(e => e.n >= 2 && e.nT > 0)
      .map(e => ({ desc: e.desc, scheme: e.scheme, t: e.sumT / e.nT, acc: avg(e.acc) * 100, n: e.n }))
      .sort((a, b) => a.t - b.t);
  }, [fRounds]);

  const usersAgg = useMemo(() => {
    const m = new Map<string, { games: number; best: number; acc: number[]; find: number[] }>();
    for (const r of fRounds) {
      const k = r.name ?? 'anon';
      const e = m.get(k) ?? { games: 0, best: 0, acc: [], find: [] };
      e.games++; e.best = Math.max(e.best, r.score); e.acc.push(r.accuracy);
      if (r.finds_count > 0) e.find.push(r.duration_s * 1000 / r.finds_count);
      m.set(k, e);
    }
    return [...m.entries()].map(([name, e]) => ({ name, games: e.games, best: e.best, acc: avg(e.acc) * 100, find: avg(e.find) }))
      .sort((a, b) => b.games - a.games);
  }, [fRounds]);

  function useScheme(s: Scheme) { try { localStorage.setItem('hex_apply_scheme', JSON.stringify(s)); } catch { /* ignore */ } router.push('/'); }

  const heatTime = useMemo(() => buildHeat(fFinds, f => f.target_layer, f => f.target_bin, f => f.time_ms), [fFinds]);
  const heatErr = useMemo(() => buildHeat(fFinds, f => f.target_layer, f => f.target_bin, f => (f.wrong_clicks > 0 ? 1 : 0)), [fFinds]);
  const hotCount = useMemo(() => { // count of wrong clicks per clicked cell
    const items = fClicks.filter(c => !c.is_correct);
    const rs = [...new Set(items.map(c => c.clicked_layer))].sort((a, b) => a - b);
    const cs = [...new Set(items.map(c => c.clicked_bin))].sort((a, b) => a - b);
    const cnt = new Map<string, number>();
    for (const c of items) { const k = c.clicked_layer + ',' + c.clicked_bin; cnt.set(k, (cnt.get(k) ?? 0) + 1); }
    return { rows: rs.map(String), cols: cs.map(String), values: rs.map(r => cs.map(c => cnt.get(r + ',' + c) ?? null)) };
  }, [fClicks]);

  if (loading) return <main className="an"><p className="hint">Loading analytics…</p></main>;

  return (
    <main className="an">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <h1 style={{ margin: 0 }}>Analytics</h1>
        <Link href="/">← back to game</Link>
      </div>

      <div className="an-filters">
        {FACETS.map(f => (
          <label key={f.key} style={{ fontSize: 12 }}>
            <span className="label-up" style={{ display: 'block' }}>{f.label}</span>
            <select value={sel[f.key] ?? 'any'} onChange={e => setSel(s => ({ ...s, [f.key]: e.target.value }))}>
              <option value="any">any</option>
              {options[f.key]?.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        ))}
        <button className="ghost" style={{ alignSelf: 'flex-end' }} onClick={() => setSel({})}>Reset filters</button>
        <div style={{ marginLeft: 'auto', alignSelf: 'flex-end', display: 'flex', gap: 6 }}>
          {(['findtime', 'accuracy', 'score'] as Metric[]).map(m => (
            <button key={m} className={metric === m ? 'primary' : 'ghost'} onClick={() => setMetric(m)}>{m}</button>
          ))}
        </div>
      </div>

      <div className="stat-cards">
        <StatCard label="rounds" value={String(fRounds.length)} />
        <StatCard label="players" value={String(players)} />
        <StatCard label="finds" value={String(fFinds.length || fRounds.reduce((a, r) => a + r.finds_count, 0))} />
        <StatCard label="avg score" value={avg(fRounds.map(r => r.score)).toFixed(1)} />
        <StatCard label="avg accuracy" value={pct(avg(fRounds.map(r => r.accuracy)) * 100)} />
        <StatCard label="avg find time" value={msToS(avgFind)} />
        <StatCard label="valid" value={pct(validPct)} />
      </div>

      <h2 style={{ margin: '8px 0 10px', fontSize: 15 }}>By scheme facet — {metricName}</h2>
      <div className="an-grid">
        {FACETS.filter(f => f.key !== 'valid').map(f => (
          <BarChart key={f.key} title={f.label} fmt={metricFmt} data={groupAvg(fRounds, f.get, metricVal)} />
        ))}
      </div>

      <h2 style={{ margin: '18px 0 10px', fontSize: 15 }}>Distributions</h2>
      <div className="an-grid">
        <Histogram title="Score" values={fRounds.map(r => r.score)} fmt={v => v.toFixed(0)} />
        <Histogram title="Accuracy" values={fRounds.map(r => r.accuracy * 100)} fmt={v => v.toFixed(0) + '%'} />
        <Histogram title="Per-round avg find time" values={fRounds.filter(r => r.finds_count > 0).map(r => r.duration_s * 1000 / r.finds_count)} fmt={msToS} />
        {fFinds.length > 0 && <Histogram title="Per-find time" values={fFinds.map(f => f.time_ms)} fmt={msToS} />}
      </div>

      {fFinds.length === 0 ? (
        <p className="hint" style={{ marginTop: 18 }}>Per-find &amp; per-click analytics are empty — run <code>supabase/analytics-policies.sql</code> to enable read access to finds/clicks.</p>
      ) : (
        <>
          <h2 style={{ margin: '18px 0 10px', fontSize: 15 }}>Where people struggle (target position)</h2>
          <div className="an-grid">
            <Heatmap title="Avg find time — layer × bin" rows={heatTime.rows} cols={heatTime.cols} values={heatTime.values} fmt={msToS} />
            <Heatmap title="Error rate — layer × bin" rows={heatErr.rows} cols={heatErr.cols} values={heatErr.values} fmt={v => Math.round(v * 100) + '%'} />
            <BarChart title="Avg find time by layer" fmt={msToS} data={groupAvg(fFinds, f => String(f.target_layer), f => f.time_ms)} />
            <BarChart title="Avg find time by bin position" fmt={msToS} data={groupAvg(fFinds, f => String(f.target_bin), f => f.time_ms)} />
            <BarChart title="Avg find time by column" fmt={msToS} data={groupAvg(fFinds, f => String(f.target_column), f => f.time_ms)} />
            <BarChart title="Error rate by layer" fmt={v => Math.round(v * 100) + '%'} data={groupAvg(fFinds, f => String(f.target_layer), f => (f.wrong_clicks > 0 ? 1 : 0))} />
          </div>

          <h2 style={{ margin: '18px 0 10px', fontSize: 15 }}>Within-round learning &amp; mistakes</h2>
          <div className="an-grid">
            <BarChart title="Avg find time by find # (learning curve)" fmt={msToS} data={groupAvg(fFinds, f => String(f.seq + 1), f => f.time_ms)} />
            <Heatmap title="Wrong-click hotspots — clicked layer × bin" rows={hotCount.rows} cols={hotCount.cols} values={hotCount.values} fmt={v => String(Math.round(v))} />
          </div>
        </>
      )}

      <h2 style={{ margin: '18px 0 10px', fontSize: 15 }}>Players</h2>
      <div className="card-box">
        <div className="lb-head" style={{ gridTemplateColumns: '1fr auto auto auto auto' }}><span>name</span><span>games</span><span>best</span><span>acc</span><span>find</span></div>
        {usersAgg.map((u, i) => (
          <div className="lb-row" key={i} style={{ gridTemplateColumns: '1fr auto auto auto auto' }}>
            {u.name === 'anon' ? <span className="lb-name">anon</span> : <Link className="lb-name" href={`/user?name=${encodeURIComponent(u.name)}`}>{u.name}</Link>}
            <span className="mono">{u.games}</span><span className="mono">{u.best}</span><span className="mono">{pct(u.acc)}</span><span className="mono">{msToS(u.find)}</span>
          </div>
        ))}
        {usersAgg.length === 0 && <p className="hint">No players yet.</p>}
      </div>

      <h2 style={{ margin: '18px 0 10px', fontSize: 15 }}>Schemes ranked by avg find time (≥2 rounds)</h2>
      <div className="card-box">
        <div className="lb-head" style={{ gridTemplateColumns: '1fr auto auto auto auto' }}><span>scheme</span><span>find time</span><span>acc</span><span>n</span><span /></div>
        {schemeAgg.slice(0, 20).map((s, i) => (
          <div className="lb-row" key={i} style={{ gridTemplateColumns: '1fr auto auto auto auto' }}>
            <span className="lb-name" title={s.desc}>{s.desc}</span>
            <span className="mono">{msToS(s.t)}</span><span className="mono">{pct(s.acc)}</span><span className="mono">{s.n}</span>
            <button className="ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => useScheme(s.scheme)}>Use</button>
          </div>
        ))}
        {schemeAgg.length === 0 && <p className="hint">Not enough data yet.</p>}
      </div>
    </main>
  );
}
