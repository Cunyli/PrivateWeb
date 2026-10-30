-- All synthetic records and request counters are rolled back.
begin;
set local statement_timeout='15s';
delete from app_private.portfolio_request_budgets where budget_key like 'booking:%' or budget_key like 'semantic-search:%';
do $verify$
declare result record; n integer; total integer;
begin
  if has_function_privilege('anon','public.consume_portfolio_request_budget(text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.consume_portfolio_request_budget(text,text)','EXECUTE') then raise exception 'Public budget RPC access'; end if;
  if has_table_privilege('anon','public.photo_session_bookings','SELECT')
    or has_table_privilege('authenticated','public.photo_session_bookings','INSERT') then raise exception 'Public booking access'; end if;
  for n in 1..4 loop
    select * into result from public.consume_portfolio_request_budget('booking',repeat('0',64));
    if not result.allowed then raise exception 'Booking allowed requests rejected'; end if;
  end loop;
  select * into result from public.consume_portfolio_request_budget('booking',repeat('0',64));
  if result.allowed or result.retry_after<1 then raise exception 'Client limit not enforced'; end if;
  select max(used_count) into total from app_private.portfolio_request_budgets where budget_key='booking:hour';
  if total<>4 then raise exception 'Rejected client used global quota'; end if;
  select * into result from public.consume_portfolio_request_budget('booking',repeat('1',64));
  if not result.allowed then raise exception 'Other visitor was blocked'; end if;
  for n in 1..12 loop
    select * into result from public.consume_portfolio_request_budget('semantic-search',repeat('0',64));
    if not result.allowed then raise exception 'Search allowed requests rejected'; end if;
  end loop;
  select * into result from public.consume_portfolio_request_budget('semantic-search',repeat('0',64));
  if result.allowed then raise exception 'Search client limit not enforced'; end if;
end;
$verify$;
insert into public.ai_tasks(id,owner_email,title,type,status) values('00000000-0000-4000-8000-000000000030','security-check@example.invalid','Synthetic MFA test','ai','inbox');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000030","role":"authenticated","email":"security-check@example.invalid","aal":"aal1"}',true);
do $verify$ begin if exists(select 1 from public.ai_tasks where id='00000000-0000-4000-8000-000000000030') then raise exception 'AAL1 read private task'; end if; end; $verify$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000030","role":"authenticated","email":"security-check@example.invalid","aal":"aal2"}',true);
do $verify$ begin if not exists(select 1 from public.ai_tasks where id='00000000-0000-4000-8000-000000000030') then raise exception 'AAL2 owner lost access'; end if; end; $verify$;
reset role;
select 'PASS: client quotas, global quota isolation, private booking grants, AAL1 denial, AAL2 owner access' as verification;
rollback;
