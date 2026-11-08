-- 1) Item budget: kategori + status/tanggal bayar
alter table public.budgets
  add column if not exists category text not null default 'Lainnya',
  add column if not exists paid_date date;

-- Data lama: item yang sudah punya biaya aktual dianggap sudah dibayar (perilaku "Total terpakai" tidak berubah).
update public.budgets set paid_date = current_date where actual_cost > 0 and paid_date is null;

-- 2) Alokasi budget per kategori (satu baris per acara + kategori)
create table if not exists public.category_budgets (
  id uuid primary key default gen_random_uuid(),
  profile text not null default 'ade' check (profile in ('ade','rohman')),
  category text not null,
  amount int8 not null default 0,
  unique (profile, category)
);
create index if not exists category_budgets_profile_idx on public.category_budgets(profile);

-- 3) Keamanan: hanya akun email (bukan anonim) yang boleh mengakses data.
--    Akun dibuat manual di Supabase (Authentication > Users > Add user); pendaftaran publik dimatikan.
create or replace function public.is_member() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') <> ''
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
$$;

alter table public.category_budgets enable row level security;

do $$
declare t text;
begin
  foreach t in array array['settings','tasks','budgets','vendors','vendor_payments','category_budgets'] loop
    execute format('drop policy if exists "app_access" on public.%I', t);
    execute format('create policy "app_access" on public.%I for all to authenticated using (public.is_member()) with check (public.is_member())', t);
  end loop;
end $$;

drop policy if exists "receipts_authenticated_all" on storage.objects;
create policy "receipts_authenticated_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'receipts' and public.is_member())
  with check (bucket_id = 'receipts' and public.is_member());

do $$
begin
  alter publication supabase_realtime add table public.category_budgets;
exception when others then null;
end $$;
