create table rounds (
  id uuid primary key default gen_random_uuid(),
  name text,
  created_at timestamptz default now(),
  scheme jsonb not null,
  scheme_key text not null,
  duration_s int not null,
  finds_count int not null,
  score int not null,
  accuracy real not null,
  wrong_clicks_total int not null,
  valid boolean not null
);
create table finds (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references rounds(id) on delete cascade,
  seq int not null,
  target_column int, target_layer int, target_bin int,
  target_display text, time_ms int, wrong_clicks int
);
create table clicks (
  id uuid primary key default gen_random_uuid(),
  find_id uuid references finds(id) on delete cascade,
  clicked_column int, clicked_layer int, clicked_bin int,
  is_correct boolean, time_ms int
);
create index on rounds (scheme_key);
create index on rounds (valid, score desc);

alter table rounds enable row level security;
alter table finds  enable row level security;
alter table clicks enable row level security;
create policy "anon insert rounds" on rounds for insert to anon with check (true);
create policy "anon read rounds"   on rounds for select to anon using (true);
create policy "anon insert finds"  on finds  for insert to anon with check (true);
create policy "anon insert clicks" on clicks for insert to anon with check (true);
