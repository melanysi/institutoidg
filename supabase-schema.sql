create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    full_name text not null,
    role text not null default 'member' check (role in ('member', 'admin')),
    status text not null default 'pending' check (status in ('pending', 'active', 'blocked')),
    created_at timestamptz not null default now()
);

create table if not exists public.applications (
    id uuid primary key default gen_random_uuid(),
    application_type text not null check (
        application_type in ('volunteer', 'beneficiary', 'course', 'sponsor', 'donation')
    ),
    full_name text not null,
    email text not null,
    phone text,
    details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
    privacy_consent boolean not null,
    privacy_consent_at timestamptz not null default now(),
    privacy_notice_version text not null default '2026-10',
    status text not null default 'pending' check (
        status in ('pending', 'reviewing', 'approved', 'rejected', 'completed')
    ),
    internal_notes text not null default '' check (char_length(internal_notes) <= 3000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.applications
    add column if not exists privacy_consent boolean not null default false,
    add column if not exists privacy_consent_at timestamptz not null default now(),
    add column if not exists privacy_notice_version text not null default '2026-10',
    add column if not exists internal_notes text not null default '';

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'applications'
          and column_name = 'user_id'
    ) then
        alter table public.applications alter column user_id drop not null;
    end if;
end;
$$;

alter table public.applications
    drop constraint if exists applications_application_type_check;
alter table public.applications
    add constraint applications_application_type_check
    check (application_type in ('volunteer', 'beneficiary', 'course', 'sponsor', 'donation'));
alter table public.applications
    drop constraint if exists applications_status_check;
alter table public.applications
    add constraint applications_status_check
    check (status in ('pending', 'reviewing', 'approved', 'rejected', 'completed'));
alter table public.applications
    drop constraint if exists applications_internal_notes_check;
alter table public.applications
    add constraint applications_internal_notes_check
    check (char_length(internal_notes) <= 3000);

create index if not exists applications_type_created_at_idx
    on public.applications (application_type, created_at desc);
create index if not exists applications_status_created_at_idx
    on public.applications (status, created_at desc);

create or replace function public.create_idg_staff_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    staff_name text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
begin
    if staff_name is null then
        staff_name := coalesce(split_part(new.email, '@', 1), 'Equipe IDG');
    end if;

    insert into public.profiles (id, full_name)
    values (new.id, staff_name)
    on conflict (id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created_idg on auth.users;
drop function if exists public.create_applicant_profile();
create trigger on_auth_user_created_idg
    after insert on auth.users
    for each row execute function public.create_idg_staff_profile();

create or replace function public.touch_idg_application()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists on_idg_application_updated on public.applications;
drop trigger if exists on_idg_application_status_changed on public.applications;
create trigger on_idg_application_updated
    before update on public.applications
    for each row execute function public.touch_idg_application();

create or replace function public.is_idg_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.profiles
        where id = (select auth.uid())
          and role = 'admin'
          and status = 'active'
    );
$$;

alter table public.profiles enable row level security;
alter table public.applications enable row level security;

drop policy if exists "Applicants can read their own profile" on public.profiles;
drop policy if exists "IDG staff can read their own profile" on public.profiles;
create policy "IDG staff can read their own profile"
    on public.profiles for select to authenticated
    using (id = (select auth.uid()) and (select public.is_idg_admin()));

drop policy if exists "Applicants and staff can read permitted applications" on public.applications;
drop policy if exists "Only staff can read applications" on public.applications;
create policy "Only staff can read applications"
    on public.applications for select to authenticated
    using ((select public.is_idg_admin()));

drop policy if exists "Only staff can update applications" on public.applications;
create policy "Only staff can update applications"
    on public.applications for update to authenticated
    using ((select public.is_idg_admin()))
    with check ((select public.is_idg_admin()));

revoke all on public.profiles from anon, authenticated;
revoke all on public.applications from anon, authenticated;
grant select on public.profiles to authenticated;
grant select, update (status, internal_notes) on public.applications to authenticated;
grant all on public.applications to service_role;

revoke all on function public.create_idg_staff_profile() from public, anon, authenticated;
revoke all on function public.touch_idg_application() from public, anon, authenticated;
revoke all on function public.is_idg_admin() from public, anon;
drop function if exists public.sync_idg_profile_status();
grant execute on function public.is_idg_admin() to authenticated;

-- Create or invite this authorized email in Supabase Authentication before running this statement.
insert into public.profiles (id, full_name, role, status)
select
    id,
    coalesce(nullif(trim(raw_user_meta_data ->> 'full_name'), ''), 'Equipe IDG'),
    'admin',
    'active'
from auth.users
where email = 'despertando.idg@gmail.com'
on conflict (id) do update
set role = 'admin', status = 'active';
