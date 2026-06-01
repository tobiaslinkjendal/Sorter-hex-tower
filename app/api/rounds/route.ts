import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase';
import { schemeKey, Scheme } from '@/lib/scheme';

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    name: string | null; scheme: Scheme; durationS: number;
    summary: { findsCount: number; score: number; accuracy: number; wrongClicksTotal: number; valid: boolean;
      finds: { seq: number; target: {column:number;rowFromTop:number;leftRank:number};
        targetDisplay: string; timeMs: number; wrongClicks: number;
        clicks: { bin:{column:number;rowFromTop:number;leftRank:number}; isCorrect:boolean; timeMs:number }[] }[] };
  };
  const sb = serverSupabase();
  const { data: round, error } = await sb.from('rounds').insert({
    name: body.name, scheme: body.scheme, scheme_key: schemeKey(body.scheme),
    duration_s: body.durationS, finds_count: body.summary.findsCount, score: body.summary.score,
    accuracy: body.summary.accuracy, wrong_clicks_total: body.summary.wrongClicksTotal,
    valid: body.summary.valid,
  }).select('id').single();
  if (error || !round) return NextResponse.json({ error: error?.message }, { status: 500 });

  // Generate child IDs ourselves so we never read rows back — the anon role only
  // has SELECT on `rounds`, and requesting a returned representation on `finds`/
  // `clicks` would make PostgREST roll the insert back.
  for (const f of body.summary.finds) {
    const findId = crypto.randomUUID();
    const { error: findErr } = await sb.from('finds').insert({
      id: findId, round_id: round.id, seq: f.seq, target_column: f.target.column,
      target_layer: f.target.rowFromTop, target_bin: f.target.leftRank,
      target_display: f.targetDisplay, time_ms: f.timeMs, wrong_clicks: f.wrongClicks,
    });
    if (findErr) return NextResponse.json({ error: `finds: ${findErr.message}` }, { status: 500 });

    const rows = f.clicks.map(c => ({
      find_id: findId, clicked_column: c.bin.column, clicked_layer: c.bin.rowFromTop,
      clicked_bin: c.bin.leftRank, is_correct: c.isCorrect, time_ms: c.timeMs,
    }));
    if (rows.length) {
      const { error: clickErr } = await sb.from('clicks').insert(rows);
      if (clickErr) return NextResponse.json({ error: `clicks: ${clickErr.message}` }, { status: 500 });
    }
  }
  return NextResponse.json({ id: round.id });
}
