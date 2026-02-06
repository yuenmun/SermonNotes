alter table public.sermons
  drop constraint if exists sermons_status_check;

alter table public.sermons
  add constraint sermons_status_check
  check (status in ('processing', 'ready', 'failed'));
