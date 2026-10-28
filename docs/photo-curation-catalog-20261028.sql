-- Add a read-only, service-only catalog. Existing ratings and publication flags are untouched.
begin;
create or replace function public.portfolio_curation_catalog()
returns jsonb language sql stable security invoker set search_path='' as $catalog$
 with approved as (
  select p.*,s.is_published as set_published,s.cover_image_url as set_cover,c.image_width,c.image_height,
   coalesce((select jsonb_agg(t.name order by t.name) from public.picture_taggings pt join public.tags t on t.id=pt.tag_id where pt.picture_id=p.id),'[]'::jsonb) as tags,
   (s.title ~* '^portrait booking samples$' or exists(select 1 from public.picture_taggings pt join public.tags t on t.id=pt.tag_id where pt.picture_id=p.id and t.name='portrait-library')) as booking
  from app_private.photo_curation c join public.pictures p on p.id=c.picture_id join public.picture_sets s on s.id=p.picture_set_id
  where c.state='keep' and p.is_published=true
 ), eligible as (select * from approved where set_published=true or booking=true)
 select jsonb_build_object(
  'ids',coalesce((select jsonb_agg(id order by id) from (select picture_id as id from app_private.photo_curation where state='trash' union all select id from app_private.photo_curation_assets where state='trash') x),'[]'::jsonb),
  'photos',coalesce((select jsonb_agg(jsonb_build_object(
   'id',p.id,'setId',p.picture_set_id,'src',p.image_url,'title',p.title,'subtitle',p.subtitle,'description',p.description,
   'createdAt',p.created_at,'order',p.order_index,'width',p.image_width,'height',p.image_height,'tags',p.tags,
   'booking',p.booking,'setPublished',p.set_published,'setCoverSrc',p.set_cover,
   'translations',coalesce((select jsonb_object_agg(pt.locale,jsonb_build_object('title',pt.title,'subtitle',pt.subtitle,'description',pt.description)) from public.picture_translations pt where pt.picture_id=p.id and pt.locale in ('en','zh')),'{}'::jsonb)
  ) order by p.picture_set_id,p.order_index nulls last,p.id) from eligible p),'[]'::jsonb),
  'assets',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'src',a.detail_url,'source',a.source_url,'previewUrl',a.preview_url,'title',a.title,'width',a.image_width,'height',a.image_height) order by a.id desc) from app_private.photo_curation_assets a where a.state='keep'),'[]'::jsonb)
 );
$catalog$;
revoke all on function public.portfolio_curation_catalog() from PUBLIC,anon,authenticated;
grant execute on function public.portfolio_curation_catalog() to service_role;
notify pgrst,'reload schema';
commit;
