-- Run once in the Supabase SQL editor to let the analytics dashboard read the
-- per-find / per-click data. (No personal data — just coordinates and times.)
create policy "anon read finds"  on finds  for select to anon using (true);
create policy "anon read clicks" on clicks for select to anon using (true);
