begin;
create function idg_private.gallery_download_operation_allowed(photo_bucket text)
returns boolean language plpgsql stable set search_path = '' as $$
begin
  if photo_bucket <> 'idg-media' then return false; end if;
  raise log 'IDG gallery download context operation=% method=% role=%',
    coalesce(nullif(storage.operation(), ''), 'empty'),
    coalesce(nullif(current_setting('request.method', true), ''), 'empty'), current_user;
  return storage.allow_only_operation('object.get_authenticated');
end;
$$;
revoke all on function idg_private.gallery_download_operation_allowed(text) from public;
grant execute on function idg_private.gallery_download_operation_allowed(text) to anon,authenticated;
alter policy "Visitors download published IDG photos" on storage.objects using (
  bucket_id='idg-media' and idg_private.gallery_download_operation_allowed(bucket_id)
  and exists (select 1 from public.idg_home_gallery_photos photo where photo.storage_path=objects.name)
);
commit;
