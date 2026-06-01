import { NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase';

// Raw-ish dump for the analytics dashboard (capped). finds/clicks require the
// select policies in supabase/analytics-policies.sql; without them they come back empty.
export async function GET() {
  const sb = serverSupabase();
  const rounds = (await sb.from('rounds')
    .select('id,name,created_at,scheme,scheme_key,duration_s,finds_count,score,accuracy,wrong_clicks_total,valid')
    .order('created_at', { ascending: false }).limit(5000)).data ?? [];
  const finds = (await sb.from('finds')
    .select('id,round_id,seq,target_column,target_layer,target_bin,time_ms,wrong_clicks').limit(50000)).data ?? [];
  const clicks = (await sb.from('clicks')
    .select('find_id,clicked_column,clicked_layer,clicked_bin,is_correct,time_ms').limit(100000)).data ?? [];
  return NextResponse.json({ rounds, finds, clicks });
}
