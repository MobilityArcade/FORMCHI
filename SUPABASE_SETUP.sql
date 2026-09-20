create table if not exists public.aki_usage (
  session_id text primary key,
  event text not null check (event in ('start','stop')),
  device_id text not null,
  version text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds between 0 and 86400)
);
create index if not exists aki_usage_ended_at_idx on public.aki_usage (ended_at desc);
create index if not exists aki_usage_device_id_idx on public.aki_usage (device_id);
alter table public.aki_usage enable row level security;
revoke all on table public.aki_usage from anon, authenticated;
grant select, insert, update, delete on table public.aki_usage to service_role;
