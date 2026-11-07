-- Vendor, pembayaran vendor (DP/cicilan/pelunasan), dan tenggat bayar
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Lainnya',
  phone text not null default '',
  total_cost int8 not null default 0,
  notes text not null default ''
);

create table if not exists public.vendor_payments (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  label text not null default 'DP',
  amount int8 not null default 0,
  due_date date not null,
  paid_date date
);

create index if not exists vendor_payments_vendor_idx on public.vendor_payments(vendor_id);
create index if not exists vendor_payments_due_idx on public.vendor_payments(due_date);

alter table public.vendors enable row level security;
alter table public.vendor_payments enable row level security;

drop policy if exists "app_access" on public.vendors;
drop policy if exists "app_access" on public.vendor_payments;
create policy "app_access" on public.vendors         for all to authenticated using (true) with check (true);
create policy "app_access" on public.vendor_payments for all to authenticated using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table public.vendors;
  alter publication supabase_realtime add table public.vendor_payments;
exception when others then null;
end $$;
