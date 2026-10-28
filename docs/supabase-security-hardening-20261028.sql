begin;

set local lock_timeout = '5s';

set local statement_timeout = '30s';

set local search_path = pg_catalog, public, extensions;

-- No user rows or image objects are altered.

drop policy if exists "select_public_policy" on public."pictures";

drop policy if exists "pictures_public_read" on public."pictures";

drop policy if exists "picture_sets_public_read" on public."picture_sets";

drop policy if exists "portfolio publication boundary" on public."pictures";

create policy "portfolio publication boundary" on public."pictures" as restrictive for select to anon, authenticated using (is_published is true and exists (select 1 from public.picture_sets ps where ps.id = pictures.picture_set_id and ps.is_published is true));

drop policy if exists "portfolio publication boundary" on public."picture_sets";

create policy "portfolio publication boundary" on public."picture_sets" as restrictive for select to anon, authenticated using (is_published is true);

revoke INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table "public"."locations" from PUBLIC, anon, authenticated;

revoke INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table "public"."categories" from PUBLIC, anon, authenticated;

revoke ALL on table "public"."picture_categories" from PUBLIC, anon, authenticated;

revoke INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table "public"."picture_set_translations" from PUBLIC, anon, authenticated;

revoke INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table "public"."picture_locations" from PUBLIC, anon, authenticated;

revoke INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table "public"."picture_set_likes" from PUBLIC, anon, authenticated;

revoke ALL on table "public"."picture_section_assignments" from PUBLIC, anon, authenticated;

revoke INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table "public"."picture_set_section_assignments" from PUBLIC, anon, authenticated;

revoke ALL on table "public"."picture_taggings" from PUBLIC, anon, authenticated;

revoke ALL on table "public"."picture_set_participants" from PUBLIC, anon, authenticated;

revoke INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table "public"."picture_likes" from PUBLIC, anon, authenticated;

revoke INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table "public"."sections" from PUBLIC, anon, authenticated;

revoke INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table "public"."seasons" from PUBLIC, anon, authenticated;

revoke ALL on table "public"."tags" from PUBLIC, anon, authenticated;

revoke ALL on table "public"."roles" from PUBLIC, anon, authenticated;

revoke ALL on table "public"."picture_set_taggings" from PUBLIC, anon, authenticated;

revoke ALL on table "public"."picture_set_categories" from PUBLIC, anon, authenticated;

revoke INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table "public"."picture_comments" from PUBLIC, anon, authenticated;

revoke INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table "public"."picture_set_comments" from PUBLIC, anon, authenticated;

revoke INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table "public"."picture_sets" from PUBLIC, anon, authenticated;

revoke INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table "public"."pictures" from PUBLIC, anon, authenticated;

revoke INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table "public"."picture_translations" from PUBLIC, anon, authenticated;

revoke INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on table "public"."picture_set_locations" from PUBLIC, anon, authenticated;

revoke ALL on table "public"."picture_embeddings" from PUBLIC, anon, authenticated;

revoke ALL on table "public"."people" from PUBLIC, anon, authenticated;

revoke ALL on table "public"."picture_participants" from PUBLIC, anon, authenticated;

revoke execute on function "public"."set_updated_at"() from PUBLIC, anon, authenticated;

grant execute on function "public"."set_updated_at"() to service_role;

revoke execute on function "public"."sync_location_geom_latlon"() from PUBLIC, anon, authenticated;

grant execute on function "public"."sync_location_geom_latlon"() to service_role;

revoke execute on function "public"."refresh_picture_search"(p_id bigint) from PUBLIC, anon, authenticated;

grant execute on function "public"."refresh_picture_search"(p_id bigint) to service_role;

revoke execute on function "public"."refresh_picture_set_search"(p_id bigint) from PUBLIC, anon, authenticated;

grant execute on function "public"."refresh_picture_set_search"(p_id bigint) to service_role;

revoke execute on function "public"."trg_fn_refresh_on_tag_rename"() from PUBLIC, anon, authenticated;

grant execute on function "public"."trg_fn_refresh_on_tag_rename"() to service_role;

revoke execute on function "public"."trg_fn_refresh_picture_on_tagging"() from PUBLIC, anon, authenticated;

grant execute on function "public"."trg_fn_refresh_picture_on_tagging"() to service_role;

revoke execute on function "public"."trg_fn_refresh_picture_on_translation"() from PUBLIC, anon, authenticated;

grant execute on function "public"."trg_fn_refresh_picture_on_translation"() to service_role;

revoke execute on function "public"."trg_fn_refresh_picture_search"() from PUBLIC, anon, authenticated;

grant execute on function "public"."trg_fn_refresh_picture_search"() to service_role;

revoke execute on function "public"."trg_fn_refresh_picture_set_search"() from PUBLIC, anon, authenticated;

grant execute on function "public"."trg_fn_refresh_picture_set_search"() to service_role;

revoke execute on function "public"."trg_fn_refresh_pset_on_tagging"() from PUBLIC, anon, authenticated;

grant execute on function "public"."trg_fn_refresh_pset_on_tagging"() to service_role;

revoke execute on function "public"."trg_fn_refresh_pset_on_translation"() from PUBLIC, anon, authenticated;

grant execute on function "public"."trg_fn_refresh_pset_on_translation"() to service_role;

revoke execute on function "public"."set_picture_embeddings_updated_at"() from PUBLIC, anon, authenticated;

grant execute on function "public"."set_picture_embeddings_updated_at"() to service_role;

revoke execute on function "public"."intel_feed_delete_item"(p_owner_email text, p_id text) from PUBLIC, anon, authenticated;

grant execute on function "public"."intel_feed_delete_item"(p_owner_email text, p_id text) to service_role;

revoke execute on function "public"."trg_fn_build_picture_search"() from PUBLIC, anon, authenticated;

grant execute on function "public"."trg_fn_build_picture_search"() to service_role;

revoke execute on function "public"."trg_fn_build_picture_set_search"() from PUBLIC, anon, authenticated;

grant execute on function "public"."trg_fn_build_picture_set_search"() to service_role;

revoke execute on function "public"."match_pictures_by_embedding"(query_embedding vector, match_count integer, min_similarity double precision, min_lng double precision, min_lat double precision, max_lng double precision, max_lat double precision) from PUBLIC, anon, authenticated;

grant execute on function "public"."match_pictures_by_embedding"(query_embedding vector, match_count integer, min_similarity double precision, min_lng double precision, min_lat double precision, max_lng double precision, max_lat double precision) to service_role;

revoke execute on function "public"."intel_feed_read_items"(p_owner_email text, p_limit integer) from PUBLIC, anon, authenticated;

grant execute on function "public"."intel_feed_read_items"(p_owner_email text, p_limit integer) to service_role;

revoke execute on function "public"."intel_feed_upsert_item"(p_owner_email text, p_id text, p_source_id text, p_source_type text, p_canonical_url text, p_external_id text, p_title text, p_status text, p_tags text[], p_block jsonb, p_raw jsonb, p_replace_existing boolean) from PUBLIC, anon, authenticated;

grant execute on function "public"."intel_feed_upsert_item"(p_owner_email text, p_id text, p_source_id text, p_source_type text, p_canonical_url text, p_external_id text, p_title text, p_status text, p_tags text[], p_block jsonb, p_raw jsonb, p_replace_existing boolean) to service_role;

alter default privileges for role postgres in schema public revoke all on tables from PUBLIC, anon, authenticated;

alter default privileges for role postgres in schema public revoke all on sequences from PUBLIC, anon, authenticated;

alter default privileges for role postgres in schema public revoke execute on functions from PUBLIC, anon, authenticated;

alter default privileges for role postgres revoke execute on functions from PUBLIC;

do $move$ begin if exists(select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pg_trgm' and n.nspname='public') then alter extension pg_trgm set schema extensions; end if; end $move$;

create or replace function public.enforce_portfolio_api_access()
returns void language plpgsql stable security invoker set search_path = '' as $guard$
declare
  request_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', current_user);
  request_path text := regexp_replace(btrim(coalesce(current_setting('request.path', true), ''), '/'), '^rest/v1/', '');
begin
  if request_role not in ('anon', 'authenticated') then return; end if;
  if request_path = any(array[
    'picture_sets','pictures','picture_set_translations','picture_translations',
    'picture_set_locations','picture_locations','picture_set_section_assignments',
    'locations','categories','seasons','sections','ai_tasks',
    'v_picture_comment_counts','v_picture_like_counts','v_picture_set_comment_counts',
    'v_picture_set_like_counts','v_picture_primary_location','v_picture_set_primary_location',
    'v_pictures_markers','v_picture_sets_markers',
    'rpc/get_picture_sets_by_radius','rpc/get_pictures_by_radius',
    'rpc/get_picture_clusters_bbox','rpc/get_picture_set_clusters_bbox','rpc/nullif_blank'
  ]) then return; end if;
  raise insufficient_privilege using message = 'This resource is not available to public API clients';
end;
$guard$;

revoke all on function public.enforce_portfolio_api_access() from PUBLIC;

grant execute on function public.enforce_portfolio_api_access() to anon, authenticated, service_role, authenticator;

alter role authenticator set pgrst.db_pre_request = 'public.enforce_portfolio_api_access';

notify pgrst, 'reload config';

notify pgrst, 'reload schema';

select set_config('app.expected_public_pictures',(select count(*)::text from public.pictures p join public.picture_sets ps on ps.id=p.picture_set_id where p.is_published is true and ps.is_published is true),true);

do $verify$ begin
 if has_table_privilege('anon','public.pictures','TRUNCATE')
 or has_table_privilege('authenticated','public.pictures','UPDATE')
 or has_table_privilege('anon','public.picture_embeddings','SELECT')
 or has_function_privilege('anon','public.match_pictures_by_embedding(extensions.vector,integer,double precision,double precision,double precision,double precision,double precision)','EXECUTE') then
  raise exception 'A public write, vector or internal RPC privilege remains';
 end if;
end $verify$;

set local role anon;

select set_config('request.jwt.claims','{"role":"anon"}',true);

do $verify$ begin
 if (select count(*) from public.pictures) <> current_setting('app.expected_public_pictures')::bigint then
  raise exception 'Anonymous visible pictures do not match published pictures';
 end if;
end $verify$;

select count(*) as anonymous_public_pictures from public.pictures;

select set_config('request.path','/rpc/st_estimatedextent',true);

do $verify$ begin
 begin
  perform public.enforce_portfolio_api_access();
  raise exception 'The high privilege RPC was not blocked';
 exception when insufficient_privilege then null;
 end;
end $verify$;

reset role;

set local role authenticated;

select set_config('request.jwt.claims','{"role":"authenticated"}',true);

do $verify$ begin
 if (select count(*) from public.pictures) <> current_setting('app.expected_public_pictures')::bigint then
  raise exception 'Authenticated visible pictures do not match published pictures';
 end if;
end $verify$;

select count(*) as authenticated_public_pictures from public.pictures;

reset role;

set local role service_role;

select count(*) as service_role_all_pictures from public.pictures;

reset role;
commit;
