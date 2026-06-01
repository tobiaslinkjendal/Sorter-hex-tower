import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const schemeKey = req.nextUrl.searchParams.get('schemeKey');
  const sb = serverSupabase();
  const overall = await sb.from('rounds').select('name,score,accuracy,scheme,scheme_key,created_at')
    .eq('valid', true).order('score', { ascending: false }).limit(10);
  let perScheme = null;
  if (schemeKey) {
    perScheme = (await sb.from('rounds').select('name,score,accuracy,scheme,created_at')
      .eq('valid', true).eq('scheme_key', schemeKey)
      .order('score', { ascending: false }).limit(10)).data;
  }
  const all = await sb.from('rounds').select('score').eq('valid', true);
  const scores = (all.data ?? []).map(r => r.score);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  return NextResponse.json({ overall: overall.data ?? [], perScheme, averageScore: avg, totalRounds: scores.length });
}
