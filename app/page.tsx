'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Configurator from '@/components/Configurator';
import AddressPrompt from '@/components/AddressPrompt';
import TowerCanvas, { TowerHandle } from '@/components/TowerCanvas';
import { store } from '@/lib/store';
import { Scheme, schemeKey, randomizeScheme } from '@/lib/scheme';
import { Appearance, defaultAppearance, loadAppearance, saveAppearance } from '@/lib/appearance';
import { buildTower, addressOf, Bin } from '@/lib/tower-model';
import { createRound, clickBin, isOver, summarize, isValidRound, Round, Summary } from '@/lib/round-engine';
import { playSound } from '@/lib/sound';

const JUMP_APEX = 170, JUMP_END = 360, SHAKE_END = 300;
const rseed = () => Math.floor(Math.random() * 1e9);
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Phase = 'config' | 'play' | 'practice' | 'results';
interface LRow { name: string | null; score: number; accuracy: number; scheme: Scheme }
interface Board { overall: LRow[]; perScheme: LRow[] | null; averageScore: number; totalRounds: number }
interface PopRow { schemeKey: string; scheme: Scheme; count: number }

export default function HomePage() {
  const [scheme, setScheme] = useState<Scheme>(() => store.scheme);
  const [appearance, setAppearance] = useState<Appearance>(defaultAppearance);
  const [name, setName] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [phase, setPhase] = useState<Phase>('config');
  const [seed, setSeed] = useState(() => rseed());
  const tower = useMemo(() => buildTower(scheme, mulberry32(seed)), [scheme, seed]);

  const roundRef = useRef<Round | null>(null);
  const towerApi = useRef<TowerHandle>(null);
  const done = useRef(false);
  const [remaining, setRemaining] = useState(60);
  const [frac, setFrac] = useState(1);
  const [cardTarget, setCardTarget] = useState<Bin | null>(null);
  const [green, setGreen] = useState(0);
  const [red, setRed] = useState(0);
  const [anim, setAnim] = useState<{ type: 'jump' | 'shake' | null; key: number }>({ type: null, key: 0 });

  const [board, setBoard] = useState<Board | null>(null);
  const [summary, setSummary] = useState<(Summary & { score: number }) | null>(null);
  const [resCollapsed, setResCollapsed] = useState(false);
  const [popular, setPopular] = useState<PopRow[]>([]);

  useEffect(() => {
    const n = localStorage.getItem('hex_name'); if (n) setName(n);
    setAppearance(loadAppearance());
    fetch('/api/popular').then(r => r.json()).then(d => setPopular(d.popular ?? [])).catch(() => {});
  }, []);
  const changeAppearance = (a: Appearance) => { setAppearance(a); saveAppearance(a); };

  function handleScheme(next: Scheme) {
    if (next.binsPerSection !== scheme.binsPerSection || next.layers !== scheme.layers) setSeed(rseed());
    setScheme(next);
  }
  function randomize() { setScheme(randomizeScheme(Math.random)); setSeed(rseed()); }
  function applyScheme(s: Scheme) { setScheme(s); setSeed(rseed()); setPhase('config'); setCollapsed(false); }

  function begin(timed: boolean) {
    store.name = name.trim() || null; store.scheme = scheme;
    if (name.trim()) localStorage.setItem('hex_name', name.trim());
    const s = rseed(); setSeed(s);
    const playTower = buildTower(scheme, mulberry32(s));
    const dur = timed ? appearance.durationS * 1000 : Infinity;
    towerApi.current?.reset();
    roundRef.current = createRound(playTower, dur, Math.random, performance.now());
    done.current = false;
    setCardTarget(roundRef.current.target);
    setGreen(0); setRed(0); setRemaining(appearance.durationS); setFrac(1);
    setCollapsed(true); setPhase(timed ? 'play' : 'practice');
    playSound('start', appearance.sound);
  }

  function cancelRound() { done.current = true; setPhase('config'); setCollapsed(false); }
  function stopPractice() { setPhase('config'); setCollapsed(false); }

  useEffect(() => {
    if (phase !== 'play') return;
    const dur = appearance.durationS * 1000;
    const id = setInterval(() => {
      const now = performance.now(); const r = roundRef.current!;
      const left = dur - (now - r.startMs);
      setRemaining(Math.max(0, Math.ceil(left / 1000)));
      setFrac(Math.max(0, left / dur));
      if (isOver(r, now) && !done.current) finish();
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function finish() {
    done.current = true;
    playSound('finish', appearance.sound);
    const r = roundRef.current!;
    const sum = summarize(r);
    const valid = isValidRound(sum);
    const score = Math.round(sum.findsCount * 60 / appearance.durationS);
    const finds = r.finds.map((f, i) => ({
      seq: i, target: f.target, targetDisplay: f.targetDisplay, timeMs: f.endMs - f.startMs,
      wrongClicks: f.wrongClicks,
      clicks: r.clicks.filter(c => c.timeMs >= (f.startMs - r.startMs) && c.timeMs <= (f.endMs - r.startMs)),
    }));
    setSummary({ ...sum, score });
    towerApi.current?.twirl();
    setPhase('results'); setCollapsed(true); setResCollapsed(false);
    const key = schemeKey(scheme);
    try {
      await fetch('/api/rounds', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: store.name, scheme, durationS: appearance.durationS, summary: { ...sum, score, valid, finds } }),
      });
      const b = await (await fetch(`/api/leaderboard?schemeKey=${encodeURIComponent(key)}`)).json();
      setBoard(b);
      fetch('/api/popular').then(r2 => r2.json()).then(d => setPopular(d.popular ?? [])).catch(() => {});
    } catch { /* offline: still show local summary */ }
  }

  function onPick(bin: Bin) {
    if ((phase !== 'play' && phase !== 'practice') || done.current) return;
    const res = clickBin(roundRef.current!, bin, performance.now());
    roundRef.current = res.state;
    if (res.correct) {
      playSound('correct', appearance.sound);
      towerApi.current?.onCorrect(bin);
      setAnim(a => ({ type: 'jump', key: a.key + 1 }));
      const next = res.state.target;
      setTimeout(() => { setCardTarget(next); setGreen(g => g + 1); }, JUMP_APEX);
      setTimeout(() => setAnim(a => ({ type: null, key: a.key })), JUMP_END);
    } else {
      playSound('wrong', appearance.sound);
      towerApi.current?.onWrong(bin);
      setRed(r => r + 1);
      setAnim(a => ({ type: 'shake', key: a.key + 1 }));
      setTimeout(() => setAnim(a => ({ type: null, key: a.key })), SHAKE_END);
    }
  }

  const inRound = phase === 'play' || phase === 'practice';
  const promptSegs = inRound && cardTarget ? addressOf(tower, cardTarget).segments : null;
  const autoSpin = phase === 'config' || phase === 'results';

  const leaderList = (rows: LRow[] | null | undefined) => (
    <ul className="board">
      {(rows ?? []).map((r, i) => (
        <li key={i} className={r.name === store.name && r.score === summary?.score ? 'me' : ''}>
          <span>{i + 1}. {r.name ?? 'anon'}</span>
          <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="mono">{r.score} · {Math.round(r.accuracy * 100)}%</span>
            <button className="ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => applyScheme(r.scheme)}>Try this</button>
          </span>
        </li>
      ))}
      {(!rows || rows.length === 0) && <li><span className="hint">No valid rounds yet.</span><span /></li>}
    </ul>
  );

  return (
    <div className="app">
      <aside className={`panel ${collapsed ? 'collapsed' : ''}`}>
        <div className="panel-head">
          <span className="panel-title">Hex&nbsp;Tower</span>
          <button className="icon-btn" aria-label="toggle panel" onClick={() => setCollapsed(c => !c)}>{collapsed ? '▸' : '◂'}</button>
        </div>
        <div className="panel-body">
          {phase === 'config' ? (
            <>
              {popular.length > 0 && (
                <div className="cfg-row">
                  <span className="ico">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M9 2l2 4 4 .5-3 3 .8 4.5L9 16l-3.8 2 .8-4.5-3-3 4-.5z" /></svg>
                  </span>
                  <div className="field">
                    <span className="label-up">Popular setups</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {popular.map((p, i) => (
                        <button key={p.schemeKey} className="ghost" style={{ flex: 1, padding: '6px 4px' }}
                          title={`${p.scheme.order.join('→')} · ${p.scheme.columnType}/${p.scheme.layerType}/${p.scheme.binType}`}
                          onClick={() => applyScheme(p.scheme)}>#{i + 1}<br /><span className="hint">{p.count} runs</span></button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="cfg-row">
                <span className="ico">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <circle cx="9" cy="6" r="3" /><path d="M3 16c0-3.3 2.7-5 6-5s6 1.7 6 5" />
                  </svg>
                </span>
                <div className="field">
                  <span className="label-up">Name (remembered)</span>
                  <input type="text" value={name} placeholder="anonymous"
                    onChange={e => { setName(e.target.value); localStorage.setItem('hex_name', e.target.value); }} />
                </div>
              </div>
              <Configurator scheme={scheme} onChange={handleScheme} appearance={appearance}
                onAppearance={changeAppearance} onRandomize={randomize} />
            </>
          ) : (
            <p className="hint">Round in progress…</p>
          )}
        </div>
      </aside>

      <main className="stage">
        {phase === 'play' ? (
          <div className="countbar">
            <div className="countbar-fill" style={{ width: `${frac * 100}%` }} />
            <button className="countbar-cancel" onClick={cancelRound} aria-label="cancel round">✕</button>
            <span className="countbar-num">{remaining}s</span>
          </div>
        ) : phase === 'practice' ? (
          <div className="topbar">
            <button onClick={stopPractice}>✕ Stop</button>
            <span className="panel-title">Practice — untimed, not recorded</span>
            <span />
          </div>
        ) : phase === 'results' ? (
          <div className="topbar"><span className="panel-title">Round complete</span><span className="hint">tower keeps spinning · results →</span></div>
        ) : (
          <div className="topbar"><span className="panel-title">Find the bin, fast.</span><span className="hint">Configure left · drag to spin</span></div>
        )}

        <div className="stage-main">
          {inRound && (
            <>
              <div className="score"><span className="g">{green}</span><span className="r">{red}</span></div>
              {promptSegs && (
                <div key={anim.key} className={`card ${anim.type ?? ''}`}>
                  <AddressPrompt segments={promptSegs} colorblind={appearance.colorblind} />
                </div>
              )}
            </>
          )}
          {phase === 'config' && (
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="primary start-btn" onClick={() => begin(true)}>Start ▶ {appearance.durationS}s</button>
              <button className="start-btn" onClick={() => begin(false)}>Practice</button>
            </div>
          )}
          <div className="canvas-wrap">
            <TowerCanvas ref={towerApi} tower={tower} appearance={appearance} onPick={onPick}
              pickable={inRound} autoSpin={autoSpin} />
          </div>
          <p className="hint">{inRound ? 'Click the bin · drag to rotate' : 'Drag to spin'}</p>
        </div>
      </main>

      {phase === 'results' && summary && (
        <aside className={`panel right ${resCollapsed ? 'collapsed' : ''}`}>
          <div className="panel-head">
            <button className="icon-btn" aria-label="toggle results" onClick={() => setResCollapsed(c => !c)}>{resCollapsed ? '◂' : '▸'}</button>
            <span className="panel-title">Results</span>
          </div>
          <div className="panel-body">
            <div className="stat-row" style={{ marginBottom: 14 }}>
              <div className="stat"><b>{summary.findsCount}</b><span>found</span></div>
              <div className="stat"><b>{summary.score}</b><span>score /60s</span></div>
              <div className="stat"><b>{Math.round(summary.accuracy * 100)}%</b><span>accuracy</span></div>
              <div className="stat"><b>{summary.wrongClicksTotal}</b><span>wrong</span></div>
            </div>
            {board && (
              <p style={{ margin: '0 0 12px' }}>Average: <b className="mono">{board.averageScore.toFixed(1)}</b>
                {summary.score > board.averageScore ? ' — you beat it.' : ''}</p>
            )}
            <p className="label-up">Leaderboard — overall</p>
            {leaderList(board?.overall)}
            <p className="label-up" style={{ marginTop: 16 }}>Leaderboard — this scheme</p>
            {leaderList(board?.perScheme)}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="primary" style={{ flex: 1 }} onClick={() => begin(true)}>▶ Play again</button>
              <button style={{ flex: 1 }} onClick={() => { setPhase('config'); setCollapsed(false); }}>Options</button>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
