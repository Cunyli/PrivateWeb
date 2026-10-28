-- Remove only this security pass's expendable rate counters after reverting
-- the two application callers. Never run as an automatic error fallback.
begin;
set local lock_timeout='5s';
drop function if exists public.consume_portfolio_request_budget(text);
drop table if exists app_private.portfolio_request_budgets;
-- Leave the schema in place: it may contain unrelated future objects.
notify pgrst,'reload schema';
commit;
