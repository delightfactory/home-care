-- Optional removal only after frontend rollback. Leaving these read-only RPCs is the safer first rollback.
-- Browser builds containing the new client fall back only on PGRST202 when an RPC is absent.
begin;
set local lock_timeout = '2s';
drop function public.get_order_counts();
drop function public.get_route_counts();
drop function public.get_customer_counts();
drop function public.get_expense_counts();
commit;
