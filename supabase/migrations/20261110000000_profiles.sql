-- Dua acara dalam satu aplikasi: 'ade' dan 'rohman'. Data lama otomatis menjadi milik 'ade'.
alter table public.settings        add column if not exists profile text not null default 'ade' check (profile in ('ade','rohman'));
alter table public.tasks           add column if not exists profile text not null default 'ade' check (profile in ('ade','rohman'));
alter table public.budgets         add column if not exists profile text not null default 'ade' check (profile in ('ade','rohman'));
alter table public.vendors         add column if not exists profile text not null default 'ade' check (profile in ('ade','rohman'));
alter table public.vendor_payments add column if not exists profile text not null default 'ade' check (profile in ('ade','rohman'));

create unique index if not exists settings_profile_key on public.settings(profile);
create index if not exists tasks_profile_idx on public.tasks(profile);
create index if not exists budgets_profile_idx on public.budgets(profile);
create index if not exists vendors_profile_idx on public.vendors(profile);
create index if not exists vendor_payments_profile_idx on public.vendor_payments(profile);

-- Pengaturan awal untuk acara Rohman (id 2); acara Ade memakai baris id 1
insert into public.settings (id, profile, wedding_date, master_budget)
values (2, 'rohman', now() + interval '6 months', 50000000)
on conflict (id) do nothing;
