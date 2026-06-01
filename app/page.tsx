'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Star, User, ArrowClockwise } from '@phosphor-icons/react';
import Configurator from '@/components/Configurator';
import AddressPrompt from '@/components/AddressPrompt';
import TowerCanvas, { TowerHandle } from '@/components/TowerCanvas';
import { store } from '@/lib/store';
import { Scheme, Segment, schemeKey, randomizeScheme } from '@/lib/scheme';
import { Appearance, defaultAppearance, loadAppearance, saveAppearance } from '@/lib/appearance';
import { buildTower, addressOf, Bin } from '@/lib/tower-model';
import { createRound, clickBin, isOver, summarize, isValidRound, Round, Summary } from '@/lib/round-engine';
import { playSound } from '@/lib/sound';

const JUMP_APEX = 170, JUMP_END = 360, SHAKE_END = 300, TWIRL_MS = 1500;
const rseed = () => Math.floor(Math.random() * 1e9);
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Phase = 'home' | 'countdown' | 'play' | 'practice';
interface LRow { name: string | null; score: number; accuracy: number; scheme: Scheme }
interface Board { overall: LRow[]; averageScore: number; totalRounds: number }
interface PopRow { schemeKey: string; scheme: Scheme; count: number }
type Sum = Summary & { score: number };
const ic = { size: 18, weight: 'light' as const };

// Filled-in placeholder address for the home preview and the countdown.
function placeholderSegments(s: Scheme): Segment[] {
  const ph = (type: string): Segment => {
    if (type === 'color') return { kind: 'color', value: '#FFBCCD' };
    if (type === 'number') return { kind: 'text', value: '0' };
    if (type === 'icon') return { kind: 'text', value: '?' };
    return { kind: 'text', value: 'x' }; // letter / handed
  };
  const map: Record<string, string> = { column: s.columnType, layer: s.layerType, bin: s.binType };
  return s.order.map(d => ph(map[d]));
}

export default function HomePage() {
  const [scheme, setScheme] = useState<Scheme>(() => store.scheme);
  const [appearance, setAppearance] = useState<Appearance>(defaultAppearance);
  const [name, setName] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [resCollapsed, setResCollapsed] = useState(true);
  const [phase, setPhase] = useState<Phase>('home');
  const [seed, setSeed] = useState(() => rseed());
  const tower = useMemo(() => buildTower(scheme, mulberry32(seed)), [scheme, seed]);

  const roundRef = useRef<Round | null>(null);
  const towerApi = useRef<TowerHandle>(null);
  const done = useRef(false);
  const cdTimeouts = useRef<number[]>([]);
  const [remaining, setRemaining] = useState(60);
  const [frac, setFrac] = useState(1);
  const [cdFrac, setCdFrac] = useState(0);
  const [cdText, setCdText] = useState('3');
  const [cardTarget, setCardTarget] = useState<Bin | null>(null);
  const [green, setGreen] = useState(0);
  const [red, setRed] = useState(0);
  const [anim, setAnim] = useState<{ type: 'jump' | 'shake' | null; key: number }>({ type: null, key: 0 });

  const [board, setBoard] = useState<Board | null>(null);
  const [schemeBoards, setSchemeBoards] = useState<Record<string, LRow[]>>({});
  const [summary, setSummary] = useState<Sum | null>(null);
  const [popular, setPopular] = useState<PopRow[]>([]);
  const [boardTab, setBoardTab] = useState<string>('overall');
  const [hasRun, setHasRun] = useState(false);
  const [showButtons, setShowButtons] = useState(true);

  const locked = phase !== 'home';
  const inRound = phase === 'play' || phase === 'practice';
  const autoSpin = phase === 'home' && appearance.autospin;
  const startLabel = `${hasRun ? 'Replay' : 'Start'} ${appearance.durationS}s`;

  async function loadBoards(pops: PopRow[]) {
    try {
      setBoard(await (await fetch('/api/leaderboard')).json());
      const map: Record<string, LRow[]> = {};
      await Promise.all(pops.map(async p => {
        const r = await (await fetch(`/api/leaderboard?schemeKey=${encodeURIComponent(p.schemeKey)}`)).json();
        map[p.schemeKey] = r.perScheme ?? [];
      }));
      setSchemeBoards(map);
    } catch { /* offline */ }
  }

  useEffect(() => {
    const n = localStorage.getItem('hex_name'); if (n) setName(n);
    setAppearance(loadAppearance());
    try { const raw = localStorage.getItem('hex_last'); if (raw) setSummary(JSON.parse(raw).summary); } catch { /* ignore */ }
    fetch('/api/popular').then(r => r.json()).then(d => { const p = d.popular ?? []; setPopular(p); loadBoards(p); }).catch(() => {});
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && phase !== 'home') cancelAll(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const changeAppearance = (a: Appearance) => { setAppearance(a); saveAppearance(a); setHasRun(false); };
  function handleScheme(next: Scheme) {
    if (next.binsPerSection !== scheme.binsPerSection || next.layers !== scheme.layers) setSeed(rseed());
    setScheme(next); setHasRun(false);
  }
  function randomize() { setScheme(randomizeScheme(Math.random)); setSeed(rseed()); setHasRun(false); }
  function applyScheme(s: Scheme) { setScheme(s); setSeed(rseed()); setHasRun(false); setPhase('home'); setCollapsed(false); setShowButtons(true); }

  function begin(timed: boolean) {
    store.name = name.trim() || null; store.scheme = scheme;
    if (name.trim()) localStorage.setItem('hex_name', name.trim());
    setGreen(0); setRed(0); setCardTarget(null);
    setCollapsed(true); setResCollapsed(true); setPhase('countdown'); setCdFrac(0); setCdText('3');
    // "3" shows with no bar for 900ms, then each number fills a step (~100ms ramp).
    cdTimeouts.current = [
      window.setTimeout(() => { setCdFrac(0.33); setCdText('2'); }, 900),
      window.setTimeout(() => { setCdFrac(0.66); setCdText('1'); }, 1900),
      window.setTimeout(() => { setCdFrac(1); setCdText('GO!'); }, 2900),
      window.setTimeout(() => reallyBegin(timed), 3200),
    ];
  }
  function reallyBegin(timed: boolean) {
    const s = rseed(); setSeed(s);
    const playTower = buildTower(scheme, mulberry32(s));
    const dur = timed ? appearance.durationS * 1000 : Infinity;
    towerApi.current?.reset();
    roundRef.current = createRound(playTower, dur, Math.random, performance.now());
    done.current = false;
    setCardTarget(roundRef.current.target);
    setRemaining(appearance.durationS); setFrac(1);
    setPhase(timed ? 'play' : 'practice');
    playSound('start', appearance.sound);
  }
  function cancelAll() {
    cdTimeouts.current.forEach(t => window.clearTimeout(t)); cdTimeouts.current = [];
    done.current = true; setPhase('home'); setCollapsed(false); setShowButtons(true);
  }

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
    const key = schemeKey(scheme);
    const finalSum: Sum = { ...sum, score };
    setSummary(finalSum);
    try { localStorage.setItem('hex_last', JSON.stringify({ summary: finalSum, schemeKey: key })); } catch { /* ignore */ }
    towerApi.current?.twirl();
    setPhase('home'); setCollapsed(true); setResCollapsed(false);
    setHasRun(true); setShowButtons(false);
    setTimeout(() => setShowButtons(true), TWIRL_MS);
    try {
      await fetch('/api/rounds', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: store.name, scheme, durationS: appearance.durationS, summary: { ...sum, score, valid, finds } }),
      });
      const p = (await (await fetch('/api/popular')).json()).popular ?? [];
      setPopular(p); loadBoards(p);
    } catch { /* offline */ }
  }

  function onPick(bin: Bin) {
    if (!inRound || done.current) return;
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

  const cardSegs = inRound && cardTarget ? addressOf(tower, cardTarget).segments : placeholderSegments(scheme);
  const rows = boardTab === 'overall' ? board?.overall : schemeBoards[boardTab];

  const board_ = (
    <>
      <div className="lb-tabs">
        <button className={boardTab === 'overall' ? 'primary' : 'ghost'} onClick={() => setBoardTab('overall')}>Overall</button>
        {popular.map((p, i) => (
          <button key={p.schemeKey} className={boardTab === p.schemeKey ? 'primary' : 'ghost'}
            title={`${p.scheme.order.join('→')} · ${p.scheme.columnType}/${p.scheme.layerType}/${p.scheme.binType}`}
            onClick={() => setBoardTab(p.schemeKey)}>#{i + 1}</button>
        ))}
      </div>
      <div className="lb">
        <div className="lb-head"><span>#</span><span>name</span><span>score</span><span>acc</span><span /></div>
        {(rows ?? []).map((r, i) => (
          <div className={`lb-row ${r.name === store.name && r.score === summary?.score ? 'me' : ''}`} key={i}>
            <span className="mono">{i + 1}</span>
            <span className="lb-name">{r.name ?? 'anon'}</span>
            <span className="mono">{r.score}</span>
            <span className="mono">{Math.round(r.accuracy * 100)}%</span>
            <button className="lb-try" title="Try this scheme" onClick={() => applyScheme(r.scheme)}><ArrowClockwise size={14} /></button>
          </div>
        ))}
        {(!rows || rows.length === 0) && <div className="lb-row"><span /><span className="hint">No valid rounds yet.</span><span /><span /><span /></div>}
      </div>
    </>
  );

  return (
    <div className="app">
      <aside className={`panel ${collapsed ? 'collapsed' : ''}`}>
        <div className="panel-head">
          <span className="panel-title">Hex&nbsp;Tower</span>
          <button className="icon-btn" disabled={locked} aria-label="toggle options" onClick={() => setCollapsed(c => !c)}>{collapsed ? '▸' : '◂'}</button>
        </div>
        <div className="panel-body">
          {popular.length > 0 && (
            <div className="cfg-row">
              <span className="ico"><Star {...ic} /></span>
              <div className="field">
                <span className="label-up">Popular setups</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {popular.map((p, i) => (
                    <button key={p.schemeKey} className="ghost" style={{ flex: 1, padding: '6px 4px', lineHeight: 1.2 }}
                      title={`${p.scheme.order.join('→')} · ${p.scheme.columnType}/${p.scheme.layerType}/${p.scheme.binType}`}
                      onClick={() => applyScheme(p.scheme)}>#{i + 1}<br /><span className="hint">{p.count} runs</span></button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="cfg-row">
            <span className="ico"><User {...ic} /></span>
            <div className="field">
              <span className="label-up">Name (remembered)</span>
              <input type="text" value={name} placeholder="anonymous"
                onChange={e => { setName(e.target.value); localStorage.setItem('hex_name', e.target.value); }} />
            </div>
          </div>
          <Configurator scheme={scheme} onChange={handleScheme} appearance={appearance}
            onAppearance={changeAppearance} onRandomize={randomize} />
        </div>
      </aside>

      <main className="stage">
        <div className="countbar" style={phase === 'practice' ? { background: 'var(--ink)' } : undefined}>
          {(phase === 'play' || phase === 'countdown') && (
            <div className="countbar-fill" style={{ width: `${(phase === 'countdown' ? cdFrac : frac) * 100}%` }} />
          )}
          {phase !== 'home' && <button className="countbar-cancel" onClick={cancelAll} aria-label="cancel">✕</button>}
          {phase === 'play' && <span className="countbar-num">{remaining}s</span>}
          {phase === 'countdown' && <span className="countbar-num">{cdText}</span>}
          {phase === 'practice' && <span className="countbar-num">practice</span>}
        </div>

        <div className="stage-main">
          <div className="stage-top">
            {phase === 'home'
              ? (showButtons && (
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="primary start-btn" onClick={() => begin(true)}>{startLabel}</button>
                  <button className="start-btn" onClick={() => begin(false)}>Practice</button>
                </div>
              ))
              : <div className="score"><span className="g">{green}</span><span className="r">{red}</span></div>}
            <div key={anim.key} className={`card ${anim.type ?? ''}`}>
              <AddressPrompt segments={cardSegs} colorblind={appearance.colorblind} />
            </div>
          </div>
          <div className="canvas-wrap">
            <TowerCanvas ref={towerApi} tower={tower} appearance={appearance} onPick={onPick}
              pickable={inRound} autoSpin={autoSpin} />
          </div>
        </div>
      </main>

      <aside className={`panel right ${resCollapsed ? 'collapsed' : ''}`}>
        <div className="panel-head">
          <button className="icon-btn" disabled={locked} aria-label="toggle results" onClick={() => setResCollapsed(c => !c)}>{resCollapsed ? '◂' : '▸'}</button>
          <span className="panel-title">Results</span>
        </div>
        <div className="panel-body">
          {summary ? (
            <div className="stat-row" style={{ marginBottom: 14 }}>
              <div className="stat"><b>{summary.findsCount}</b><span>found</span></div>
              <div className="stat"><b>{summary.score}</b><span>score /60s</span></div>
              <div className="stat"><b>{Math.round(summary.accuracy * 100)}%</b><span>accuracy</span></div>
              <div className="stat"><b>{summary.wrongClicksTotal}</b><span>wrong</span></div>
            </div>
          ) : <p className="hint" style={{ marginBottom: 14 }}>Play a round to see your result here.</p>}
          {board && summary && (
            <p style={{ margin: '0 0 12px' }}>Average: <b className="mono">{board.averageScore.toFixed(1)}</b>
              {summary.score > board.averageScore ? ' — you beat it.' : ''}</p>
          )}
          {board_}
          <Link href="/analytics" className="btnlink" style={{ marginTop: 14 }}>Advanced results →</Link>
        </div>
      </aside>
    </div>
  );
}
