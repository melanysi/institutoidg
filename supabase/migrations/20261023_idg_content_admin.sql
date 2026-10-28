-- IDG: content management foundation. Apply in Supabase SQL Editor after supabase-schema.sql.
-- Existing public.is_idg_admin() checks an authenticated, active administrator.
create table if not exists public.idg_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 160),
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  location_name text not null default '',
  partner_names text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','planned','confirmed','completed','cancelled')),
  is_published boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_event_interval check (ends_at is null or ends_at >= starts_at)
);
create index if not exists idg_events_public_calendar on public.idg_events(starts_at) where is_published = true;
create table if not exists public.idg_media (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.idg_events(id) on delete set null,
  storage_path text not null unique,
  alt_text text not null check (char_length(alt_text) between 3 and 300),
  caption text not null default '',
  is_published boolean not null default false,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint valid_media_path check (storage_path !~ '(^/|\\.\\.|//)' and char_length(storage_path) <= 500)
);
alter table public.idg_events enable row level security;
alter table public.idg_media enable row level security;
create policy "Published events visible to visitors" on public.idg_events
  for select to anon, authenticated using (is_published = true or (select public.is_idg_admin()));
create policy "Admins insert events" on public.idg_events
  for insert to authenticated with check ((select public.is_idg_admin()));
create policy "Admins update events" on public.idg_events
  for update to authenticated using ((select public.is_idg_admin())) with check ((select public.is_idg_admin()));
create policy "Admins delete events" on public.idg_events
  for delete to authenticated using ((select public.is_idg_admin()));
create policy "Published media visible to visitors" on public.idg_media
  for select to anon, authenticated using (is_published = true or (select public.is_idg_admin()));
create policy "Admins insert media" on public.idg_media
  for insert to authenticated with check ((select public.is_idg_admin()));
create policy "Admins update media" on public.idg_media
  for update to authenticated using ((select public.is_idg_admin())) with check ((select public.is_idg_admin()));
create policy "Admins delete media" on public.idg_media
  for delete to authenticated using ((select public.is_idg_admin()));
-- Private bucket: files cannot be fetched directly by anonymous visitors.
-- A later authenticated publishing flow can issue signed URLs for approved media.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('idg-media','idg-media',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "IDG admins upload images" on storage.objects
  for insert to authenticated with check (bucket_id = 'idg-media' and (select public.is_idg_admin()));
create policy "IDG admins read images" on storage.objects
  for select to authenticated using (bucket_id = 'idg-media' and (select public.is_idg_admin()));
create policy "IDG admins delete images" on storage.objects
  for delete to authenticated using (bucket_id = 'idg-media' and (select public.is_idg_admin()));
-- NOTE: This migration is not executed merely by committing it to GitHub.
