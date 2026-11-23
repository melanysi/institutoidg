begin;

-- Keep the media registry private and expose only the gallery fields of published rows.
drop policy "Published media visible to visitors" on public.idg_media;
create policy "IDG admins read media" on public.idg_media
  for select to authenticated using ((select public.is_idg_admin()));

create view public.idg_home_gallery_photos with (security_barrier = true) as
select id, storage_path, alt_text, caption, created_at
from public.idg_media
where is_published is true;

revoke all on public.idg_home_gallery_photos from public, anon, authenticated;
grant select on public.idg_home_gallery_photos to anon, authenticated;

-- Serve published files from the private bucket without issuing public signed URLs.
create policy "Visitors download published IDG photos" on storage.objects
  for select to anon, authenticated using (
    bucket_id = 'idg-media'
    and storage.allow_only_operation('object.get_authenticated')
    and exists (
      select 1 from public.idg_home_gallery_photos photo
      where photo.storage_path = objects.name
    )
  );

commit;
