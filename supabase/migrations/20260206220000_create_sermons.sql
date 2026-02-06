create extension if not exists pgcrypto;

create table if not exists public.sermons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  gamma_url text not null,
  created_at timestamptz not null default now(),
  status text not null default 'ready' check (status in ('ready', 'failed')),
  hero_verse text,
  key_points jsonb not null default '[]'::jsonb,
  transcript_excerpt text,
  idempotency_key text not null,
  gamma_request_id text
);

create index if not exists sermons_user_created_at_idx on public.sermons (user_id, created_at desc);
create unique index if not exists sermons_user_idempotency_idx on public.sermons (user_id, idempotency_key);

alter table public.sermons enable row level security;

create policy "sermons_select_own"
on public.sermons
for select
using (auth.uid() = user_id);

create policy "sermons_insert_own"
on public.sermons
for insert
with check (auth.uid() = user_id);

create policy "sermons_update_own"
on public.sermons
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
