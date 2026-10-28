begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create schema if not exists app_private;
revoke all on schema app_private from PUBLIC, anon, authenticated;
grant usage on schema app_private to service_role;
create table if not exists app_private.portfolio_request_budgets (
  budget_key text not null,
  window_start timestamptz not null,
  used_count integer not null check (used_count > 0),
  primary key (budget_key, window_start)
);
alter table app_private.portfolio_request_budgets enable row level security;
drop policy if exists "Service request budget access" on app_private.portfolio_request_budgets;
create policy "Service request budget access" on app_private.portfolio_request_budgets for all to service_role using (true) with check (true);
revoke all on app_private.portfolio_request_budgets from PUBLIC, anon, authenticated;
grant select, insert, update, delete on app_private.portfolio_request_budgets to service_role;
create or replace function public.consume_portfolio_request_budget(route_name text)
returns table (allowed boolean, retry_after integer)
language plpgsql volatile security invoker set search_path='' as $budget$
declare
  rule record;
  now_at timestamptz := clock_timestamp();
  slot_at timestamptz;
  consumed integer;
begin
  if route_name not in ('booking','semantic-search') then
    raise invalid_parameter_value using message='Unknown public request budget';
  end if;
  delete from app_private.portfolio_request_budgets where window_start < now_at - interval '2 days';
  for rule in
    select * from (values
      ('booking',1,'hour',3600,20), ('booking',2,'day',86400,60),
      ('semantic-search',1,'minute',60,60), ('semantic-search',2,'day',86400,2000)
    ) as budgets(route,position,name,seconds,quota)
    where route=route_name order by position
  loop
    slot_at := to_timestamp(floor(extract(epoch from now_at) / rule.seconds) * rule.seconds);
    insert into app_private.portfolio_request_budgets as b (budget_key,window_start,used_count)
    values(route_name || ':' || rule.name,slot_at,1)
    on conflict (budget_key,window_start) do update
      set used_count=least(b.used_count+1,rule.quota+1)
    returning used_count into consumed;
    if consumed > rule.quota then
      return query select false,greatest(1,ceil(extract(epoch from slot_at + make_interval(secs=>rule.seconds) - now_at))::integer);
      return;
    end if;
  end loop;
  return query select true,0;
end;
$budget$;
revoke all on function public.consume_portfolio_request_budget(text) from PUBLIC, anon, authenticated;
grant execute on function public.consume_portfolio_request_budget(text) to service_role;
notify pgrst,'reload schema';
commit;
