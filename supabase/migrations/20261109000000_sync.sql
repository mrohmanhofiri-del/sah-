-- Sinkronisasi realtime untuk pengaturan (tanggal hari H & plafon budget)
do $$
begin
  alter publication supabase_realtime add table public.settings;
exception when others then null;
end $$;
