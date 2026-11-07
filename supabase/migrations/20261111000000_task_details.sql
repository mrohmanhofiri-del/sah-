-- Catatan, prioritas, dan penanggung jawab pada tugas.
alter table public.tasks
  add column if not exists notes    text not null default '',
  add column if not exists priority text not null default 'normal',
  add column if not exists assignee text not null default '';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_priority_check') then
    alter table public.tasks
      add constraint tasks_priority_check check (priority in ('rendah', 'normal', 'tinggi'));
  end if;
end $$;
