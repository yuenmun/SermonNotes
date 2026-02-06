alter table public.sermons
  add column if not exists pastor_name text,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists scripture_references jsonb not null default '[]'::jsonb;

create policy "sermons_delete_own"
on public.sermons
for delete
using (auth.uid() = user_id);
