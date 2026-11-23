begin;
alter policy "Visitors download published IDG photos" on storage.objects using (
  bucket_id = 'idg-media'
  -- The Storage GET route first verifies object metadata before serving bytes.
  and storage.allow_any_operation(array['object.get_authenticated_info','object.get_authenticated'])
  and exists (
    select 1 from public.idg_home_gallery_photos photo
    where photo.storage_path = objects.name
  )
);
commit;
