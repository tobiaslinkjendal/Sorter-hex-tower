import { NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase';
import { Scheme } from '@/lib/scheme';

// Top schemes by number of valid runs. (Aggregated in JS — fine at study scale.)
export async function GET() {
  const sb = serverSupabase();
  const { data } = await sb.from('rounds').select('scheme_key,scheme').eq('valid', true).limit(5000);
  const map = new Map<string, { count: number; scheme: Scheme }>();
  for (const r of (data ?? []) as { scheme_key: string; scheme: Scheme }[]) {
    const e = map.get(r.scheme_key) ?? { count: 0, scheme: r.scheme };
    e.count++; map.set(r.scheme_key, e);
  }
  const popular = [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([schemeKey, v]) => ({ schemeKey, scheme: v.scheme, count: v.count }));
  return NextResponse.json({ popular });
}
