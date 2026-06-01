'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { store } from '@/lib/store';

interface Row { name: string | null; score: number; accuracy: number }
interface Board { overall: Row[]; perScheme: Row[] | null; averageScore: number; totalRounds: number }

export default function ResultsPage() {
  const router = useRouter();
  const [board, setBoard] = useState<Board | null>(null);
  const s = store.lastSummary;
  const myName = store.name ?? 'anonymous';

  useEffect(() => {
    if (!s) { router.replace('/'); return; }
    fetch(`/api/leaderboard?schemeKey=${encodeURIComponent(store.lastSchemeKey ?? '')}`)
      .then(r => r.json()).then(setBoard).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!s) return null;
  const beatAvg = board && s.score > board.averageScore;

  const list = (rows: Row[] | null | undefined) => (
    <ul className="board">
      {(rows ?? []).map((r, i) => (
        <li key={i} className={r.name === store.name && r.score === s.score ? 'me' : ''}>
          <span>{i + 1}. {r.name ?? 'anon'}</span>
          <span className="mono">{r.score} · {Math.round(r.accuracy * 100)}%</span>
        </li>
      ))}
      {(!rows || rows.length === 0) && <li><span className="hint">No valid rounds yet.</span><span /></li>}
    </ul>
  );

  return (
    <main className="sheet">
      <h1 style={{ margin: '8px 0 4px' }}>Your run</h1>
      <p className="hint" style={{ marginBottom: 14 }}>{myName}</p>

      <div className="stat-row">
        <div className="stat"><b>{s.findsCount}</b><span>found</span></div>
        <div className="stat"><b>{Math.round(s.accuracy * 100)}%</b><span>accuracy</span></div>
        <div className="stat"><b>{(s.avgTimeMs / 1000).toFixed(1)}s</b><span>avg / find</span></div>
        <div className="stat"><b>{s.wrongClicksTotal}</b><span>wrong clicks</span></div>
      </div>

      {board && (
        <p style={{ margin: '14px 0' }}>
          Average across players: <b className="mono">{board.averageScore.toFixed(1)}</b>
          {beatAvg ? ' — you beat the average.' : ''}
        </p>
      )}

      <p className="label-up" style={{ marginTop: 18 }}>Leaderboard — overall</p>
      {list(board?.overall)}

      <p className="label-up" style={{ marginTop: 18 }}>Leaderboard — this scheme</p>
      {list(board?.perScheme)}

      <button className="primary" style={{ marginTop: 20 }} onClick={() => router.push('/')}>Play again</button>
    </main>
  );
}
