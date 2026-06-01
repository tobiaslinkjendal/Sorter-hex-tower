'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { store } from '@/lib/store';

export default function ResultsPage() {
  const router = useRouter();
  const [board, setBoard] = useState<any>(null);
  const s = store.lastSummary;

  useEffect(() => {
    if (!s) { router.replace('/'); return; }
    fetch(`/api/leaderboard?schemeKey=${encodeURIComponent(store.lastSchemeKey ?? '')}`)
      .then(r => r.json()).then(setBoard).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!s) return null;

  return (
    <main style={{ maxWidth: 720, margin: '30px auto', padding: 16 }}>
      <h1>Your run</h1>
      <p>Found <b>{s.findsCount}</b> bins · accuracy <b>{Math.round(s.accuracy * 100)}%</b> ·
        avg <b>{(s.avgTimeMs / 1000).toFixed(1)}s</b>/find · wrong clicks <b>{s.wrongClicksTotal}</b></p>
      {board && <p>Average score across players: <b>{board.averageScore.toFixed(1)}</b>
        {s.score > board.averageScore ? ' — you beat the average! 🎉' : ''}</p>}

      <h3>Leaderboard — overall</h3>
      <ol>{board?.overall?.map((r: any, i: number) =>
        <li key={i}>{r.name ?? 'anon'} — {r.score} ({Math.round(r.accuracy*100)}%)</li>)}</ol>

      {board?.perScheme && <>
        <h3>Leaderboard — this scheme</h3>
        <ol>{board.perScheme.map((r: any, i: number) =>
          <li key={i}>{r.name ?? 'anon'} — {r.score} ({Math.round(r.accuracy*100)}%)</li>)}</ol>
      </>}

      <button onClick={() => router.push('/')} style={{ marginTop: 16 }}>Play again</button>
    </main>
  );
}
