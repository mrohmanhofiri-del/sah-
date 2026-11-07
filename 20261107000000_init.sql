-- Skema awal Simple Wedding Planner
create table if not exists public.settings (
  id int primary key,
  wedding_date timestamptz not null,
  master_budget int8 not null default 0
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  due_date date not null,
  is_completed boolean not null default false
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  est_cost int8 not null default 0,
  actual_cost int8 not null default 0
);

-- Row Level Security: hanya sesi terautentikasi (termasuk Anonymous Auth)
alter table public.settings enable row level security;
alter table public.tasks enable row level security;
alter table public.budgets enable row level security;

drop policy if exists "app_access" on public.settings;
drop policy if exists "app_access" on public.tasks;
drop policy if exists "app_access" on public.budgets;
create policy "app_access" on public.settings for all to authenticated using (true) with check (true);
create policy "app_access" on public.tasks    for all to authenticated using (true) with check (true);
create policy "app_access" on public.budgets  for all to authenticated using (true) with check (true);

-- Data awal (bisa diubah dari ikon pengaturan di aplikasi)
insert into public.settings (id, wedding_date, master_budget)
values (1, now() + interval '6 months', 50000000)
on conflict (id) do nothing;

-- Sinkronisasi realtime antar perangkat
do $$
begin
  alter publication supabase_realtime add table public.tasks;
  alter publication supabase_realtime add table public.budgets;
exception when others then null;
end $$;
