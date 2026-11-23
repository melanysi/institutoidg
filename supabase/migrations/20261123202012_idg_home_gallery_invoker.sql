begin;

create schema if not exists idg_private;
grant usage on schema idg_private to anon, authenticated;

-- The public view runs as the caller. This non-API helper returns only the
-- approved projection so visitors need no access to the private media table.
create function idg_private.home_gallery_photos()
returns table (id uuid, storage_path text, alt_text text, caption text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select m.id, m.storage_path, m.alt_text, m.caption, m.created_at
  from public.idg_media m
  where m.is_published is true;
$$;

revoke all on function idg_private.home_gallery_photos() from public, anon, authenticated;
grant execute on function idg_private.home_gallery_photos() to anon, authenticated;

create or replace view public.idg_home_gallery_photos
with (security_invoker = true, security_barrier = true) as
select * from idg_private.home_gallery_photos();

commit;
