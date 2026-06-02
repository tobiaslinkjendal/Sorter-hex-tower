import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase';

// All valid rounds for one player (oldest first) for the per-user stats page.
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name');
  if (!name) return NextResponse.json({ rounds: [] });
  const sb = serverSupabase();
  const rounds = (await sb.from('rounds')
    .select('created_at,scheme,scheme_key,duration_s,finds_count,score,accuracy,wrong_clicks_total')
    .eq('valid', true).eq('name', name)
    .order('created_at', { ascending: true }).limit(2000)).data ?? [];
  return NextResponse.json({ rounds });
}
