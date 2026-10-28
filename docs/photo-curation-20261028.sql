begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create schema if not exists app_private;
revoke all on schema app_private from PUBLIC, anon, authenticated;
grant usage on schema app_private to service_role;

create table if not exists app_private.photo_curation (
  picture_id bigint primary key references public.pictures(id) on delete cascade,
  state text not null check (state in ('keep','trash')),
  was_published boolean,
  reviewed_at timestamptz not null default now(),
  reviewed_by uuid not null
);
create table if not exists app_private.photo_curation_sets (
  picture_set_id bigint primary key references public.picture_sets(id) on delete cascade,
  was_published boolean,
  cover_image_url text,
  cover_image_variants jsonb
);
alter table app_private.photo_curation add column if not exists image_width integer check(image_width between 1 and 20000);
alter table app_private.photo_curation add column if not exists image_height integer check(image_height between 1 and 20000);
create table if not exists app_private.photo_curation_assets (
 id bigint primary key check(id<0), source_url text not null unique,
 preview_url text not null, detail_url text not null, title text not null,
 image_width integer, image_height integer,
 state text not null default 'unreviewed' check(state in ('unreviewed','keep','trash')),
 updated_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid
);
insert into app_private.photo_curation_assets(id,source_url,preview_url,detail_url,title,image_width,image_height) values
(-1,'/photo-session/cover-florence.jpg','/photo-session/optimized/cover-florence-640.webp','/photo-session/optimized/cover-florence-1280.webp','cover-florence',640,426),
(-2,'/private/master1.jpg','/photo-session/optimized/master1-640.webp','/photo-session/optimized/master1-1280.webp','master1',640,960),
(-3,'/private/master2.jpg','/photo-session/optimized/master2-640.webp','/photo-session/optimized/master2-1280.webp','master2',640,427),
(-4,'/private/master3.jpg','/photo-session/optimized/master3-640.webp','/photo-session/optimized/master3-1280.webp','master3',640,427),
(-5,'/private/master4.jpg','/photo-session/optimized/master4-640.webp','/photo-session/optimized/master4-1280.webp','master4',640,427),
(-6,'/private/independent.jpg','/photo-session/optimized/independent-640.webp','/photo-session/optimized/independent-1280.webp','independent',640,427)
on conflict(id) do update set source_url=excluded.source_url,preview_url=excluded.preview_url,detail_url=excluded.detail_url,title=excluded.title;
alter table app_private.photo_curation enable row level security;
alter table app_private.photo_curation_sets enable row level security;
alter table app_private.photo_curation_assets enable row level security;
revoke all on app_private.photo_curation,app_private.photo_curation_sets,app_private.photo_curation_assets from PUBLIC,anon,authenticated;
grant select,insert,update,delete on app_private.photo_curation,app_private.photo_curation_sets,app_private.photo_curation_assets to service_role;
drop policy if exists "Service curation access" on app_private.photo_curation;
drop policy if exists "Service curation set access" on app_private.photo_curation_sets;
drop policy if exists "Service curation asset access" on app_private.photo_curation_assets;
create policy "Service curation access" on app_private.photo_curation for all to service_role using (true) with check (true);
create policy "Service curation set access" on app_private.photo_curation_sets for all to service_role using (true) with check (true);
create policy "Service curation asset access" on app_private.photo_curation_assets for all to service_role using (true) with check (true);

create or replace function public.portfolio_curation_index()
returns jsonb language sql stable security invoker set search_path='' as $index$
 select coalesce(jsonb_agg(jsonb_build_object('picture_id',picture_id,'state',state,'reviewed_at',reviewed_at,'image_width',image_width,'image_height',image_height)), '[]'::jsonb)
 from app_private.photo_curation;
$index$;

create or replace function public.portfolio_curation_assets_index()
returns jsonb language sql stable security invoker set search_path='' as $assets$
 select coalesce(jsonb_agg(to_jsonb(a) order by a.id desc), '[]'::jsonb) from app_private.photo_curation_assets a;
$assets$;

create or replace function public.portfolio_curation_public_state()
returns jsonb language sql stable security invoker set search_path='' as $state$
 select jsonb_build_object(
  'ids',coalesce((select jsonb_agg(id) from (select picture_id as id from app_private.photo_curation where state='trash' union all select id from app_private.photo_curation_assets where state='trash') x),'[]'::jsonb),
  'kept_portraits',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'src',p.image_url,'title',p.title,'width',c.image_width,'height',c.image_height) order by c.reviewed_at,p.order_index,p.id)
   from app_private.photo_curation c join public.pictures p on p.id=c.picture_id
   where c.state='keep' and p.is_published=true
   and (select count(distinct t.name) from public.picture_taggings pt join public.tags t on t.id=pt.tag_id where pt.picture_id=p.id and t.name in ('portrait-library','display:sample'))=2),'[]'::jsonb));
$state$;

create or replace function public.apply_portfolio_curation(p_changes jsonb,p_reviewer uuid)
returns jsonb language plpgsql volatile security invoker set search_path='' as $curate$
declare
 change_row record; picture_row record; previous_review record; saved_set record; cover_row record; asset_row record;
 set_id bigint; affected_sets bigint[]; stamp timestamptz := clock_timestamp();
 remaining_trash boolean; active_count integer; old_cover_source text;
begin
 if p_changes is null or p_reviewer is null or jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) not between 1 and 2000 then
  raise invalid_parameter_value using message='Invalid curation batch';
 end if;
 if exists(select 1 from jsonb_array_elements(p_changes) x where jsonb_typeof(x)<>'object') then
  raise invalid_parameter_value using message='Invalid curation row';
 end if;
 if exists(select 1 from jsonb_to_recordset(p_changes) as x(picture_id bigint,decision text)
           where picture_id is null or picture_id=0 or decision is null or decision not in ('keep','trash','restore'))
    or (select count(*)<>count(distinct picture_id) from jsonb_to_recordset(p_changes) as x(picture_id bigint)) then
  raise invalid_parameter_value using message='Invalid or duplicate curation picture';
 end if;
 -- Serialize concurrent curation batches; each batch changes photos and covers atomically.
 perform pg_advisory_xact_lock(20261028,73);
 if ((select count(*) from public.pictures p where p.id in (select picture_id from jsonb_to_recordset(p_changes) as x(picture_id bigint))) +
     (select count(*) from app_private.photo_curation_assets a where a.id in (select picture_id from jsonb_to_recordset(p_changes) as x(picture_id bigint)))) <> jsonb_array_length(p_changes) then
  raise invalid_parameter_value using message='Unknown curation picture';
 end if;
 perform p.id from public.pictures p where p.id in (select picture_id from jsonb_to_recordset(p_changes) as x(picture_id bigint)) order by p.id for update;
 select coalesce(array_agg(distinct p.picture_set_id),array[]::bigint[]) into affected_sets from public.pictures p where p.id in (select picture_id from jsonb_to_recordset(p_changes) as x(picture_id bigint));
 for change_row in select * from jsonb_to_recordset(p_changes) as x(picture_id bigint,decision text,expected_updated_at timestamptz,expected_reviewed_at timestamptz,image_width integer,image_height integer) order by picture_id loop
  if change_row.image_width is not null and change_row.image_width not between 1 and 20000 or change_row.image_height is not null and change_row.image_height not between 1 and 20000 then
   raise invalid_parameter_value using message='Invalid image dimensions';
  end if;
  if change_row.picture_id<0 then
   select a.* into asset_row from app_private.photo_curation_assets a where a.id=change_row.picture_id for update;
   if asset_row.updated_at is distinct from change_row.expected_updated_at or asset_row.reviewed_at is distinct from change_row.expected_reviewed_at then
    raise exception using errcode='40001',message='Curation changed in another tab; refresh before saving';
   end if;
   update app_private.photo_curation_assets set state=case when change_row.decision='restore' then 'unreviewed' else change_row.decision end,
    updated_at=stamp,reviewed_at=case when change_row.decision='restore' then null else stamp end,reviewed_by=p_reviewer,
    image_width=coalesce(change_row.image_width,image_width),image_height=coalesce(change_row.image_height,image_height) where id=change_row.picture_id;
   continue;
  end if;
  select p.* into picture_row from public.pictures p where p.id=change_row.picture_id;
  select c.* into previous_review from app_private.photo_curation c where c.picture_id=picture_row.id;
  if picture_row.updated_at is distinct from change_row.expected_updated_at or previous_review.reviewed_at is distinct from change_row.expected_reviewed_at then
   raise exception using errcode='40001',message='Curation changed in another tab; refresh before saving';
  end if;
  if change_row.decision='trash' then
   insert into app_private.photo_curation_sets(picture_set_id,was_published,cover_image_url,cover_image_variants)
    select s.id,s.is_published,s.cover_image_url,s.cover_image_variants from public.picture_sets s where s.id=picture_row.picture_set_id
    on conflict(picture_set_id) do nothing;
   insert into app_private.photo_curation as c(picture_id,state,was_published,reviewed_at,reviewed_by,image_width,image_height)
    values(picture_row.id,'trash',picture_row.is_published,stamp,p_reviewer,change_row.image_width,change_row.image_height)
    on conflict(picture_id) do update set state='trash',was_published=case when c.state='trash' then c.was_published else excluded.was_published end,reviewed_at=stamp,reviewed_by=p_reviewer,image_width=coalesce(excluded.image_width,c.image_width),image_height=coalesce(excluded.image_height,c.image_height);
   update public.pictures set is_published=false,updated_at=stamp where id=picture_row.id;
  elsif change_row.decision='keep' then
   if previous_review.state='trash' then update public.pictures set is_published=previous_review.was_published,updated_at=stamp where id=picture_row.id; end if;
   insert into app_private.photo_curation as c(picture_id,state,was_published,reviewed_at,reviewed_by,image_width,image_height)
    values(picture_row.id,'keep',picture_row.is_published,stamp,p_reviewer,change_row.image_width,change_row.image_height)
    on conflict(picture_id) do update set state='keep',reviewed_at=stamp,reviewed_by=p_reviewer,image_width=coalesce(excluded.image_width,c.image_width),image_height=coalesce(excluded.image_height,c.image_height);
  else
   if previous_review.state='trash' then update public.pictures set is_published=previous_review.was_published,updated_at=stamp where id=picture_row.id; end if;
   delete from app_private.photo_curation where picture_id=picture_row.id;
  end if;
 end loop;
 foreach set_id in array affected_sets loop
  select * into saved_set from app_private.photo_curation_sets where picture_set_id=set_id;
  if not found then continue; end if;
  select exists(select 1 from app_private.photo_curation c join public.pictures p on p.id=c.picture_id where p.picture_set_id=set_id and c.state='trash') into remaining_trash;
  if not remaining_trash then
   update public.picture_sets set is_published=saved_set.was_published,cover_image_url=saved_set.cover_image_url,cover_image_variants=saved_set.cover_image_variants where id=set_id;
   delete from app_private.photo_curation_sets where picture_set_id=set_id;
   continue;
  end if;
  select count(*) into active_count from public.pictures where picture_set_id=set_id and is_published=true;
  if active_count=0 then
   update public.picture_sets set is_published=false,cover_image_url=null,cover_image_variants='{}'::jsonb where id=set_id;
  else
   old_cover_source := substring(lower(saved_set.cover_image_url) from 'dsc[0-9]+');
   select p.*, (p.image_url=saved_set.cover_image_url or p.raw_image_url=saved_set.cover_image_url or (old_cover_source is not null and substring(lower(p.image_url) from 'dsc[0-9]+')=old_cover_source)) as original_cover
    into cover_row from public.pictures p where p.picture_set_id=set_id and p.is_published=true
    order by (p.image_url=saved_set.cover_image_url or p.raw_image_url=saved_set.cover_image_url or (old_cover_source is not null and substring(lower(p.image_url) from 'dsc[0-9]+')=old_cover_source)) desc nulls last,p.order_index nulls last,p.id limit 1;
   update public.picture_sets set is_published=saved_set.was_published,
    cover_image_url=case when cover_row.original_cover then saved_set.cover_image_url else cover_row.image_url end,
    cover_image_variants=case when cover_row.original_cover then saved_set.cover_image_variants else coalesce(cover_row.image_variants,'{}'::jsonb) end where id=set_id;
  end if;
 end loop;
 return jsonb_build_object('changed',jsonb_array_length(p_changes));
end;
$curate$;
revoke all on function public.portfolio_curation_index(),public.portfolio_curation_assets_index(),public.portfolio_curation_public_state(),public.apply_portfolio_curation(jsonb,uuid) from PUBLIC,anon,authenticated;
grant execute on function public.portfolio_curation_index(),public.portfolio_curation_assets_index(),public.portfolio_curation_public_state(),public.apply_portfolio_curation(jsonb,uuid) to service_role;
notify pgrst,'reload schema';
commit;
