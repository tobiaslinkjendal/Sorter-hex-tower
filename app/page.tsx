'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Configurator from '@/components/Configurator';
import AddressPrompt from '@/components/AddressPrompt';
import TowerCanvas, { TowerHandle } from '@/components/TowerCanvas';
import { store } from '@/lib/store';
import { Scheme, schemeKey, randomizeScheme } from '@/lib/scheme';
import { Appearance, defaultAppearance, loadAppearance, saveAppearance } from '@/lib/appearance';
import { buildTower, addressOf, Bin } from '@/lib/tower-model';
import { createRound, clickBin, isOver, summarize, isValidRound, Round } from '@/lib/round-engine';
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

type Phase = 'config' | 'play' | 'practice';

export default function HomePage() {
  const router = useRouter();
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

  useEffect(() => { const n = localStorage.getItem('hex_name'); if (n) setName(n); setAppearance(loadAppearance()); }, []);
  const changeAppearance = (a: Appearance) => { setAppearance(a); saveAppearance(a); };

  // Re-randomize the tower layout when geometry changes (so "✱" bins are truly random).
  function handleScheme(next: Scheme) {
    if (next.binsPerSection !== scheme.binsPerSection || next.layers !== scheme.layers) setSeed(rseed());
    setScheme(next);
  }
  function randomize() { setScheme(randomizeScheme(Math.random)); setSeed(rseed()); }

  function begin(timed: boolean) {
    store.name = name.trim() || null; store.scheme = scheme;
    if (name.trim()) localStorage.setItem('hex_name', name.trim());
    const s = rseed(); setSeed(s);                              // replay re-randomizes
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
    const summary = summarize(r);
    const valid = isValidRound(summary);
    const score = Math.round(summary.findsCount * 60 / appearance.durationS); // normalize to 60s
    const finds = r.finds.map((f, i) => ({
      seq: i, target: f.target, targetDisplay: f.targetDisplay, timeMs: f.endMs - f.startMs,
      wrongClicks: f.wrongClicks,
      clicks: r.clicks.filter(c => c.timeMs >= (f.startMs - r.startMs) && c.timeMs <= (f.endMs - r.startMs)),
    }));
    store.lastSummary = { ...summary, score }; store.lastSchemeKey = schemeKey(scheme);
    try {
      await fetch('/api/rounds', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: store.name, scheme, durationS: appearance.durationS, summary: { ...summary, score, valid, finds } }),
      });
    } catch { /* offline: results page still shows local summary */ }
    router.push('/results');
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

  return (
    <div className="app">
      <aside className={`panel ${collapsed ? 'collapsed' : ''}`}>
        <div className="panel-head">
          <span className="panel-title">Hex&nbsp;Tower</span>
          <button className="icon-btn" aria-label="toggle panel" onClick={() => setCollapsed(c => !c)}>
            {collapsed ? '▸' : '◂'}
          </button>
        </div>
        <div className="panel-body">
          {phase === 'config' ? (
            <>
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
            <span className="countbar-num">{remaining}s</span>
          </div>
        ) : phase === 'practice' ? (
          <div className="topbar">
            <span className="panel-title">Practice — untimed, not recorded</span>
            <button onClick={stopPractice}>■ Stop</button>
          </div>
        ) : (
          <div className="topbar">
            <span className="panel-title">Find the bin, fast.</span>
            <span className="hint">Configure left · drag to spin</span>
          </div>
        )}

        <div className="stage-main">
          {inRound ? (
            <>
              <div className="score"><span className="g">{green}</span><span className="r">{red}</span></div>
              {promptSegs && (
                <div key={anim.key} className={`card ${anim.type ?? ''}`}>
                  <AddressPrompt segments={promptSegs} colorblind={appearance.colorblind} />
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="primary start-btn" onClick={() => begin(true)}>Start ▶ {appearance.durationS}s</button>
              <button className="start-btn" onClick={() => begin(false)}>Practice</button>
            </div>
          )}

          <div className="canvas-wrap">
            <TowerCanvas ref={towerApi} tower={tower} appearance={appearance} onPick={onPick}
              pickable={inRound} autoSpin={phase === 'config'} />
          </div>
          <p className="hint">{inRound ? 'Click the bin · drag to rotate' : 'Live preview — set it up, then Start'}</p>
        </div>
      </main>
    </div>
  );
}
