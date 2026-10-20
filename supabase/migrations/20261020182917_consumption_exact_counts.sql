-- Read-only aggregation. Existing table grants and RLS remain authoritative.
-- No policies, triggers, operational rows or financial calculations are changed.
begin;
set local lock_timeout = '2s';

create function public.get_order_counts()
returns jsonb language sql stable security invoker set search_path = pg_catalog, public, pg_temp as $$
  select pg_catalog.jsonb_build_object('total',count(*),'pending',count(*) filter(where status='pending'),'scheduled',count(*) filter(where status='scheduled'),'in_progress',count(*) filter(where status='in_progress'),'completed',count(*) filter(where status='completed'),'cancelled',count(*) filter(where status='cancelled')) from public.orders;
$$;
revoke all on function public.get_order_counts() from public, anon;
grant execute on function public.get_order_counts() to authenticated;

create function public.get_route_counts()
returns jsonb language sql stable security invoker set search_path = pg_catalog, public, pg_temp as $$
  select pg_catalog.jsonb_build_object('total',count(*),'planned',count(*) filter(where status='planned'),'in_progress',count(*) filter(where status='in_progress'),'completed',count(*) filter(where status='completed')) from public.routes;
$$;
revoke all on function public.get_route_counts() from public, anon;
grant execute on function public.get_route_counts() to authenticated;

create function public.get_customer_counts()
returns jsonb language sql stable security invoker set search_path = pg_catalog, public, pg_temp as $$
  select pg_catalog.jsonb_build_object('total',count(*),'active',count(*) filter(where is_active=true),'inactive',count(*)-count(*) filter(where is_active=true)) from public.customers;
$$;
revoke all on function public.get_customer_counts() from public, anon;
grant execute on function public.get_customer_counts() to authenticated;

create function public.get_expense_counts()
returns jsonb language sql stable security invoker set search_path = pg_catalog, public, pg_temp as $$
  select pg_catalog.jsonb_build_object('total',count(*),'pending',count(*) filter(where status='pending'),'approved',count(*) filter(where status='approved'),'rejected',count(*) filter(where status='rejected')) from public.expenses;
$$;
revoke all on function public.get_expense_counts() from public, anon;
grant execute on function public.get_expense_counts() to authenticated;

commit;

