-- Restore missing tags on five already-displayed legacy portraits selected as 1.
-- Source evidence: prior public photo-session source lists, exact ID/source bindings,
-- and lib/photo-session-selection.ts (David portrait 2878 / DSC06878).
-- Does not update ratings, picture records, publication flags, or existing tags.
begin;
select pg_advisory_xact_lock(20261028,73);
create temporary table curation_tag_repairs(picture_id bigint,source_name text,tag_name text) on commit drop;
insert into curation_tag_repairs values
 (2813,'DSC00143','display:sample'),(2813,'DSC00143','model:Lijie'),
 (2815,'DSC00373','display:sample'),(2817,'DSC00471','display:sample'),
 (2819,'DSC03210','display:sample'),(2819,'DSC03210','model:Lijie'),
 (2878,'DSC06878','portrait-library'),(2878,'DSC06878','display:sample'),
 (2878,'DSC06878','model:David'),(2878,'DSC06878','location:appenzell'),(2878,'DSC06878','series:202606280121');
insert into public.tags(name,type)
 select distinct r.tag_name,'topic' from curation_tag_repairs r
 where not exists(select 1 from public.tags t where lower(t.name)=lower(r.tag_name) and t.type='topic');
insert into public.picture_taggings(picture_id,tag_id)
 select p.id,t.id from curation_tag_repairs r
 join public.pictures p on p.id=r.picture_id
 join app_private.photo_curation c on c.picture_id=p.id and c.state='keep'
 join public.tags t on lower(t.name)=lower(r.tag_name) and t.type='topic'
 where p.is_published=true and upper(p.image_url) like '%'||r.source_name||'%'
 on conflict do nothing;
commit;
