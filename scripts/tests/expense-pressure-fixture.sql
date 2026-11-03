\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
grant usage on schema auth to anon,authenticated;
create table public.roles(id uuid primary key,name text unique,permissions jsonb);
create table public.users(id uuid primary key,role_id uuid references roles);
create table public.expenses(
 id uuid primary key, amount numeric(10,2) not null, status varchar(20) not null,
 created_at timestamptz not null, category_id uuid, team_id uuid, order_id uuid,
 description text, created_by uuid, approved_by uuid, receipt_image_url text
);
create index idx_expenses_status on expenses(status,created_at desc);
create index idx_expenses_date_team on expenses(created_at desc,team_id) where team_id is not null;
create function public.check_user_permission(permission_type text,action_type text)
returns boolean language plpgsql security definer as $$
declare has_permission boolean := false;
begin
 select coalesce((r.permissions->permission_type->>action_type)::boolean,
 (r.permissions->>'admin')::boolean,false) into has_permission
 from users u join roles r on u.role_id=r.id where u.id=auth.uid();
 return coalesce(has_permission,false);
end; $$;
insert into roles
select md5(name)::uuid,name,jsonb_build_object('expenses',jsonb_build_object('read',allowed,'create',allowed,'update',allowed,'delete',name='manager'))
from (values ('manager',true),('operations_supervisor',true),('team_leader',true),('technician',true),('receptionist',false),('pending',false)) x(name,allowed);
insert into users select md5(name||'-user')::uuid,id from roles;
insert into expenses
select md5('expense-'||g)::uuid,(g%9999)::numeric/100,
 (array['pending','approved','rejected'])[1+g%3],
 '2026-10-01 00:00:00+00'::timestamptz+g*interval '5 minutes',
 case when g%5=0 then null else md5('category-'||(g%3))::uuid end,
 case when g%4=0 then null else md5('team-'||(g%2))::uuid end,
 null,case when g%2=0 then 'Fuel receipt' else 'Maintenance service' end,
 md5('manager-user')::uuid,null,null from generate_series(1,12050) g;
alter table expenses enable row level security;
grant select,insert,update,delete on expenses to anon,authenticated;
create policy expenses_select on expenses for select using(check_user_permission('expenses','read'));
create policy expenses_insert on expenses for insert with check(check_user_permission('expenses','create'));
create policy expenses_update on expenses for update using(check_user_permission('expenses','update'));
create policy expenses_delete on expenses for delete using(check_user_permission('expenses','delete'));
-- Synthetic observers prove the migration does not suppress downstream triggers.
create table public.qa_events(kind text,expense_id uuid);
create function public.qa_expense_observer() returns trigger language plpgsql security definer as $$
begin
 insert into qa_events values ('audit:'||TG_OP,coalesce(new.id,old.id));
 if TG_OP='INSERT' then insert into qa_events values ('notify:create',new.id); end if;
 if TG_OP='UPDATE' and new.status is distinct from old.status then insert into qa_events values ('notify:status',new.id); end if;
 return coalesce(new,old);
end; $$;
create trigger qa_observer after insert or update or delete on expenses for each row execute function qa_expense_observer();
create function public.qa_assert(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',message; end if; end $$;
grant execute on function public.qa_assert(boolean,text) to authenticated,anon;
analyze expenses;
