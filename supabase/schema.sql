create extension if not exists "pgcrypto";

create table if not exists public.my_data (
  id uuid primary key default gen_random_uuid(),
  owner_address text not null,
  raw_data jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.my_data enable row level security;

drop policy if exists "lab_insert_my_data" on public.my_data;
create policy "lab_insert_my_data"
on public.my_data
for insert
to anon
with check (true);

drop policy if exists "lab_select_my_data" on public.my_data;
create policy "lab_select_my_data"
on public.my_data
for select
to anon
using (true);

comment on table public.my_data is
'Client-direct PoC table for isolated lab environment only. Move reads behind a trusted server in production.';

