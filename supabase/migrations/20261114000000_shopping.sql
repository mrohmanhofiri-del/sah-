-- Daftar belanja (seserahan, souvenir, dll.) dengan rekap pembelian.
create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  profile text not null default 'ade' check (profile in ('ade','rohman')),
  name text not null,
  category text not null default 'Seserahan & mahar'
);
create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  profile text not null default 'ade' check (profile in ('ade','rohman')),
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  name text not null,
  qty int not null default 1 check (qty > 0),
  est_cost int8 not null default 0,
  actual_cost int8 not null default 0,
  store text not null default '',
  notes text not null default '',
  paid_date date
);
create index if not exists shopping_lists_profile_idx on public.shopping_lists(profile);
create index if not exists shopping_items_profile_idx on public.shopping_items(profile);
create index if not exists shopping_items_list_idx on public.shopping_items(list_id);

alter table public.shopping_lists enable row level security;
alter table public.shopping_items enable row level security;
do $$
declare t text;
begin
  foreach t in array array['shopping_lists','shopping_items'] loop
    execute format('drop policy if exists "app_access" on public.%I', t);
    execute format('create policy "app_access" on public.%I for all to authenticated using (public.is_member()) with check (public.is_member())', t);
  end loop;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.shopping_lists;
  alter publication supabase_realtime add table public.shopping_items;
exception when others then null;
end $$;
