-- Foto bukti bayar: kolom rujukan + bucket Storage privat.
alter table public.vendor_payments
  add column if not exists receipt_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Hanya pengguna yang sudah login (termasuk anonim) yang boleh membaca/menulis bukti bayar.
drop policy if exists "receipts_authenticated_all" on storage.objects;
create policy "receipts_authenticated_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'receipts')
  with check (bucket_id = 'receipts');
