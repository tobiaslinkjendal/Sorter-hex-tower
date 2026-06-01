'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Configurator from '@/components/Configurator';
import AddressPrompt from '@/components/AddressPrompt';
import TowerCanvas, { TowerHandle } from '@/components/TowerCanvas';
import { store } from '@/lib/store';
import { Scheme, schemeKey } from '@/lib/scheme';
import { Appearance, defaultAppearance, loadAppearance, saveAppearance } from '@/lib/appearance';
import { buildTower, addressOf, Bin } from '@/lib/tower-model';
import { createRound, clickBin, isOver, summarize, isValidRound, Round } from '@/lib/round-engine';

const DURATION = 60000;
const JUMP_APEX = 170, JUMP_END = 360, SHAKE_END = 300;

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function HomePage() {
  const router = useRouter();
  const [scheme, setScheme] = useState<Scheme>(() => store.scheme);
  const [appearance, setAppearance] = useState<Appearance>(defaultAppearance);
  const [name, setName] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [phase, setPhase] = useState<'config' | 'play'>('config');
  const [seed] = useState(() => Math.floor(Math.random() * 1e9));
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

  function start() {
    store.name = name.trim() || null; store.scheme = scheme;
    if (name.trim()) localStorage.setItem('hex_name', name.trim());
    towerApi.current?.reset();
    const r = createRound(tower, DURATION, Math.random, performance.now());
    roundRef.current = r; done.current = false;
    setCardTarget(r.target); setGreen(0); setRed(0); setRemaining(60); setFrac(1);
    setCollapsed(true); setPhase('play');
  }

  useEffect(() => {
    if (phase !== 'play') return;
    const id = setInterval(() => {
      const now = performance.now(); const r = roundRef.current!;
      const left = DURATION - (now - r.startMs);
      setRemaining(Math.max(0, Math.ceil(left / 1000)));
      setFrac(Math.max(0, left / DURATION));
      if (isOver(r, now) && !done.current) finish();
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function finish() {
    done.current = true;
    const r = roundRef.current!;
    const summary = summarize(r);
    const valid = isValidRound(summary);
    const finds = r.finds.map((f, i) => ({
      seq: i, target: f.target, targetDisplay: f.targetDisplay, timeMs: f.endMs - f.startMs,
      wrongClicks: f.wrongClicks,
      clicks: r.clicks.filter(c => c.timeMs >= (f.startMs - r.startMs) && c.timeMs <= (f.endMs - r.startMs)),
    }));
    store.lastSummary = summary; store.lastSchemeKey = schemeKey(scheme);
    try {
      await fetch('/api/rounds', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: store.name, scheme, durationS: 60, summary: { ...summary, valid, finds } }),
      });
    } catch { /* offline: results page still shows local summary */ }
    router.push('/results');
  }

  function onPick(bin: Bin) {
    if (phase !== 'play' || done.current) return;
    const res = clickBin(roundRef.current!, bin, performance.now());
    roundRef.current = res.state;
    if (res.correct) {
      towerApi.current?.onCorrect(bin);
      setAnim(a => ({ type: 'jump', key: a.key + 1 }));
      const next = res.state.target;
      setTimeout(() => { setCardTarget(next); setGreen(g => g + 1); }, JUMP_APEX);
      setTimeout(() => setAnim(a => ({ type: null, key: a.key })), JUMP_END);
    } else {
      towerApi.current?.onWrong(bin);
      setRed(r => r + 1);
      setAnim(a => ({ type: 'shake', key: a.key + 1 }));
      setTimeout(() => setAnim(a => ({ type: null, key: a.key })), SHAKE_END);
    }
  }

  const playing = phase === 'play';
  const promptSegs = playing && cardTarget ? addressOf(tower, cardTarget).segments : null;

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
          {!playing ? (
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
              <Configurator scheme={scheme} onChange={setScheme} appearance={appearance} onAppearance={changeAppearance} />
            </>
          ) : (
            <p className="hint">Round in progress…</p>
          )}
        </div>
      </aside>

      <main className="stage">
        {playing ? (
          <div className="countbar">
            <div className="countbar-fill" style={{ width: `${frac * 100}%` }} />
            <span className="countbar-num">{remaining}s</span>
          </div>
        ) : (
          <div className="topbar">
            <span className="panel-title">Find the bin, fast.</span>
            <span className="hint">Configure left · drag to spin</span>
          </div>
        )}

        <div className="stage-main">
          {playing ? (
            <>
              <div className="score"><span className="g">{green}</span><span className="r">{red}</span></div>
              {promptSegs && (
                <div key={anim.key} className={`card ${anim.type ?? ''}`}>
                  <AddressPrompt segments={promptSegs} colorblind={appearance.colorblind} />
                </div>
              )}
            </>
          ) : (
            <button className="primary start-btn" onClick={start}>Start ▶ 60s</button>
          )}

          <div className="canvas-wrap">
            <TowerCanvas ref={towerApi} tower={tower} appearance={appearance} onPick={onPick} pickable={playing} />
          </div>
          <p className="hint">{playing ? 'Click the bin · drag to rotate' : 'Live preview — set it up, then Start'}</p>
        </div>
      </main>
    </div>
  );
}
