begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

-- New two-argument overload; keep the old function for deployment rollback.
-- Only pseudonymous HMAC keys enter the counter table, never raw IP addresses.
create or replace function public.consume_portfolio_request_budget(route_name text, client_key text)
returns table (allowed boolean, retry_after integer)
language plpgsql volatile security invoker set search_path='' as $budget$
declare
  rule record;
  now_at timestamptz := clock_timestamp();
  slot_at timestamptz;
  consumed integer;
  rule_key text;
begin
  if route_name not in ('booking','semantic-search') or client_key !~ '^[a-f0-9]{64}$' or client_key is null then
    raise invalid_parameter_value using message='Invalid request budget';
  end if;
  delete from app_private.portfolio_request_budgets where window_start < now_at - interval '2 days';
  -- Per-client limits run first: a blocked client cannot consume everybody's quota.
  for rule in
    select * from (values
      ('booking',1,'client-quarter-hour',900,4,true), ('booking',2,'client-day',86400,12,true),
      ('booking',3,'hour',3600,20,false), ('booking',4,'day',86400,60,false),
      ('semantic-search',1,'client-minute',60,12,true), ('semantic-search',2,'client-day',86400,120,true),
      ('semantic-search',3,'minute',60,60,false), ('semantic-search',4,'day',86400,2000,false)
    ) as budgets(route,position,name,seconds,quota,per_client)
    where route=route_name order by position
  loop
    slot_at := to_timestamp(floor(extract(epoch from now_at) / rule.seconds) * rule.seconds);
    rule_key := route_name || ':' || case when rule.per_client then client_key || ':' else '' end || rule.name;
    insert into app_private.portfolio_request_budgets as b (budget_key,window_start,used_count)
      values(rule_key,slot_at,1)
      on conflict (budget_key,window_start) do update set used_count=least(b.used_count+1,rule.quota+1)
      returning used_count into consumed;
    if consumed > rule.quota then
      return query select false,greatest(1,ceil(extract(epoch from slot_at+make_interval(secs=>rule.seconds)-now_at))::integer);
      return;
    end if;
  end loop;
  return query select true,0;
end;
$budget$;
revoke all on function public.consume_portfolio_request_budget(text,text) from PUBLIC,anon,authenticated;
grant execute on function public.consume_portfolio_request_budget(text,text) to service_role;

-- AAL1 must not bypass the admin API through the directly exposed task table.
drop policy if exists "Private tasks require MFA" on public.ai_tasks;
create policy "Private tasks require MFA" on public.ai_tasks as restrictive for all to authenticated
  using ((select auth.jwt()->>'aal')='aal2') with check ((select auth.jwt()->>'aal')='aal2');

create table if not exists public.photo_session_bookings (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
  name text not null, contact text not null, date text not null,
  package_name text, package_price text, time_window text,
  status text not null default 'logged', email_sent boolean not null default false,
  email_error text, payload jsonb not null default '{}'::jsonb, user_agent text
);
create index if not exists photo_session_bookings_created_at_idx on public.photo_session_bookings(created_at desc);
alter table public.photo_session_bookings enable row level security;
revoke all on public.photo_session_bookings from PUBLIC,anon,authenticated;
grant select,insert,update,delete on public.photo_session_bookings to service_role;
drop policy if exists "photo_session_bookings_service_role_all" on public.photo_session_bookings;
create policy "photo_session_bookings_service_role_all" on public.photo_session_bookings for all to service_role using (true) with check (true);
notify pgrst,'reload schema';
commit;
