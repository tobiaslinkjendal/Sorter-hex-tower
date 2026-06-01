'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Tower3D from '@/components/Tower3D';
import AddressPrompt from '@/components/AddressPrompt';
import { store } from '@/lib/store';
import { buildTower, addressOf, Bin } from '@/lib/tower-model';
import { createRound, clickBin, isOver, summarize, isValidRound, Round } from '@/lib/round-engine';
import { schemeKey } from '@/lib/scheme';

const DURATION = 60000;

export default function RoundPage() {
  const router = useRouter();
  const tower = useMemo(() => buildTower(store.scheme, Math.random), []);
  const roundRef = useRef<Round>(createRound(tower, DURATION, Math.random, performance.now()));
  const [, force] = useState(0);
  const [remaining, setRemaining] = useState(60);
  const [flash, setFlash] = useState<'ok' | 'no' | null>(null);
  const done = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now();
      setRemaining(Math.max(0, Math.ceil((DURATION - (now - roundRef.current.startMs)) / 1000)));
      if (isOver(roundRef.current, now) && !done.current) finish();
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finish() {
    done.current = true;
    const r = roundRef.current;
    const summary = summarize(r);
    const valid = isValidRound(summary);
    const findsPayload = r.finds.map((f, i) => ({
      seq: i, target: f.target, targetDisplay: f.targetDisplay, timeMs: f.endMs - f.startMs,
      wrongClicks: f.wrongClicks,
      clicks: r.clicks.filter(c => c.timeMs >= (f.startMs - r.startMs) && c.timeMs <= (f.endMs - r.startMs)),
    }));
    store.lastSummary = summary;
    store.lastSchemeKey = schemeKey(store.scheme);
    try {
      await fetch('/api/rounds', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: store.name, scheme: store.scheme, durationS: 60,
          summary: { ...summary, valid, finds: findsPayload } }) });
    } catch { /* offline: results page still shows local summary */ }
    router.push('/results');
  }

  function onPick(bin: Bin) {
    if (done.current) return;
    const res = clickBin(roundRef.current, bin, performance.now());
    roundRef.current = res.state;
    setFlash(res.correct ? 'ok' : 'no');
    setTimeout(() => setFlash(null), 180);
    force(n => n + 1);
  }

  const prompt = addressOf(tower, roundRef.current.target);
  return (
    <main style={{ maxWidth: 820, margin: '12px auto', textAlign: 'center', padding: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>⏱ {remaining}s</span>
        <span>Found: {roundRef.current.finds.length}</span>
      </div>
      <div style={{ margin: '10px 0', outline: flash === 'ok' ? '3px solid #4caf50'
        : flash === 'no' ? '3px solid #e0524a' : 'none', borderRadius: 8 }}>
        <AddressPrompt segments={prompt.segments} />
      </div>
      <Tower3D tower={tower} onPick={onPick} />
      <p style={{ color: '#888' }}>Drag to spin · click the bin</p>
    </main>
  );
}
