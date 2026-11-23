begin;

create table public.idg_course_availability (
  course_name text primary key,
  is_open boolean not null default false
);

insert into public.idg_course_availability (course_name, is_open) values
  ('Manicure', true),
  ('Cuidador de Idoso', false),
  ('Recepcionista', false),
  ('Portaria e Controlador de Acesso', false),
  ('Trancista', false),
  ('Cuidador Infantil', true),
  ('Panificação', false);

alter table public.idg_course_availability enable row level security;
revoke all on public.idg_course_availability from public, anon, authenticated;
grant select on public.idg_course_availability to anon, authenticated;
grant update (is_open) on public.idg_course_availability to authenticated;

create policy "Visitors read availability" on public.idg_course_availability
  for select to anon, authenticated using (true);
create policy "IDG admins update course availability" on public.idg_course_availability
  for update to authenticated
  using ((select public.is_idg_admin()))
  with check ((select public.is_idg_admin()));

create function idg_private.enforce_open_course_application()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- Serialize the insert with changes to the selected course's availability.
  perform 1
  from public.idg_course_availability
  where course_name = new.details->>'course_name'
    and is_open
  for share;

  if not found then
    raise sqlstate 'PT409' using message = 'As inscrições para este curso estão encerradas.';
  end if;

  return new;
end;
$$;

revoke all on function idg_private.enforce_open_course_application()
  from public, anon, authenticated;

create trigger idg_enforce_open_course_application
before insert on public.applications
for each row when (new.application_type = 'course')
execute function idg_private.enforce_open_course_application();

commit;
