begin;
alter policy "Visitors download published IDG photos" on storage.objects using (
  bucket_id = 'idg-media'
  and exists (
    select 1 from public.idg_home_gallery_photos photo
    where photo.storage_path = objects.name
  )
);
drop function if exists idg_private.gallery_download_operation_allowed(text);
commit;
