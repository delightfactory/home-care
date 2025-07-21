-- ===================================
-- نظام الصلاحيات المحدث والمتوافق
-- تحديث للجداول الموجودة بدون تعارض
-- ===================================

-- 1. تحديث جدول الأدوار (إضافة الأعمدة المفقودة)
ALTER TABLE roles 
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. تحديث الأدوار الموجودة بالصلاحيات المفصلة (UPSERT)
INSERT INTO roles (name, name_ar, permissions, description, is_active)
VALUES
(
    'manager', 
    'المدير العام', 
    '{
        "customers": {"create": true, "read": true, "update": true, "delete": true},
        "services": {"create": true, "read": true, "update": true, "delete": true},
        "workers": {"create": true, "read": true, "update": true, "delete": true},
        "teams": {"create": true, "read": true, "update": true, "delete": true},
        "orders": {"create": true, "read": true, "update": true, "delete": true, "assign": true},
        "routes": {"create": true, "read": true, "update": true, "delete": true},
        "expenses": {"create": true, "read": true, "update": true, "delete": true, "approve": true, "limit": null},
        "reports": {"create": true, "read": true, "update": true, "delete": true, "export": true},
        "settings": {"create": true, "read": true, "update": true, "delete": true},
        "users": {"create": true, "read": true, "update": true, "delete": true, "manage_roles": true},
        "admin": true
    }',
    'صلاحيات كاملة على جميع أجزاء النظام',
    true
),
(
    'operations_supervisor', 
    'مشرف العمليات', 
    '{
        "customers": {"create": false, "read": true, "update": true, "delete": false},
        "services": {"create": false, "read": true, "update": true, "delete": false},
        "workers": {"create": false, "read": true, "update": true, "delete": false},
        "teams": {"create": true, "read": true, "update": true, "delete": false},
        "orders": {"create": true, "read": true, "update": true, "delete": false, "assign": true},
        "routes": {"create": true, "read": true, "update": true, "delete": true},
        "expenses": {"create": true, "read": true, "update": true, "delete": false, "approve": true, "limit": 500},
        "reports": {"create": true, "read": true, "update": false, "delete": false, "export": true},
        "settings": {"create": false, "read": true, "update": false, "delete": false},
        "users": {"create": false, "read": true, "update": false, "delete": false, "manage_roles": false},
        "admin": false
    }',
    'إدارة العمليات اليومية والطلبات والفرق',
    true
),
(
    'receptionist', 
    'موظف الاستقبال', 
    '{
        "customers": {"create": true, "read": true, "update": true, "delete": false},
        "services": {"create": false, "read": true, "update": false, "delete": false},
        "workers": {"create": false, "read": true, "update": false, "delete": false},
        "teams": {"create": false, "read": true, "update": false, "delete": false},
        "orders": {"create": true, "read": true, "update": true, "delete": false, "assign": false},
        "routes": {"create": false, "read": true, "update": false, "delete": false},
        "expenses": {"create": false, "read": false, "update": false, "delete": false, "approve": false, "limit": 0},
        "reports": {"create": false, "read": true, "update": false, "delete": false, "export": false},
        "settings": {"create": false, "read": false, "update": false, "delete": false},
        "users": {"create": false, "read": false, "update": false, "delete": false, "manage_roles": false},
        "admin": false
    }',
    'استقبال الطلبات وإدارة العملاء والفواتير',
    true
),
(
    'team_leader', 
    'قائد الفريق', 
    '{
        "customers": {"create": false, "read": true, "update": false, "delete": false},
        "services": {"create": false, "read": true, "update": false, "delete": false},
        "workers": {"create": false, "read": true, "update": false, "delete": false},
        "teams": {"create": false, "read": true, "update": false, "delete": false},
        "orders": {"create": false, "read": true, "update": true, "delete": false, "assign": false, "team_only": true},
        "routes": {"create": false, "read": true, "update": true, "delete": false, "team_only": true},
        "expenses": {"create": true, "read": true, "update": true, "delete": false, "approve": false, "limit": 200, "team_only": true},
        "reports": {"create": false, "read": true, "update": false, "delete": false, "export": false, "team_only": true},
        "settings": {"create": false, "read": false, "update": false, "delete": false},
        "users": {"create": false, "read": false, "update": false, "delete": false, "manage_roles": false},
        "admin": false
    }',
    'إدارة مهام الفريق وتسجيل المصروفات وتحديث حالة الطلبات',
    true
)
ON CONFLICT (name) DO UPDATE
SET 
    name_ar = EXCLUDED.name_ar,
    permissions = EXCLUDED.permissions,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- 3. تفعيل RLS على الجداول المتبقية (التي لم يتم تفعيلها مسبقاً)
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 4. حذف السياسات القديمة البسيطة
DROP POLICY IF EXISTS "Authenticated users can view customers" ON customers;
DROP POLICY IF EXISTS "Users can view orders based on role" ON orders;

-- 5. إنشاء السياسات المحدثة والمفصلة

-- سياسات العملاء
CREATE POLICY "customers_select" ON customers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users u 
            JOIN roles r ON u.role_id = r.id 
            WHERE u.id = auth.uid() 
            AND (
                (r.permissions->'customers'->>'read')::boolean = true
                OR (r.permissions->>'admin')::boolean = true
            )
        )
    );

CREATE POLICY "customers_insert" ON customers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            JOIN roles r ON u.role_id = r.id 
            WHERE u.id = auth.uid() 
            AND (
                (r.permissions->'customers'->>'create')::boolean = true
                OR (r.permissions->>'admin')::boolean = true
            )
        )
    );

CREATE POLICY "customers_update" ON customers
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users u 
            JOIN roles r ON u.role_id = r.id 
            WHERE u.id = auth.uid() 
            AND (
                (r.permissions->'customers'->>'update')::boolean = true
                OR (r.permissions->>'admin')::boolean = true
            )
        )
    );

CREATE POLICY "customers_delete" ON customers
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users u 
            JOIN roles r ON u.role_id = r.id 
            WHERE u.id = auth.uid() 
            AND (
                (r.permissions->'customers'->>'delete')::boolean = true
                OR (r.permissions->>'admin')::boolean = true
            )
        )
    );

-- سياسات الطلبات المحدثة
CREATE POLICY "orders_select_updated" ON orders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users u 
            JOIN roles r ON u.role_id = r.id 
            WHERE u.id = auth.uid() 
            AND (
                (r.permissions->'orders'->>'read')::boolean = true
                OR (r.permissions->>'admin')::boolean = true
                OR (
                    (r.permissions->'orders'->>'team_only')::boolean = true
                    AND EXISTS (
                        SELECT 1 FROM workers w
                        JOIN team_members tm ON w.id = tm.worker_id
                        JOIN routes rt ON tm.team_id = rt.team_id
                        JOIN route_orders ro ON rt.id = ro.route_id
                        WHERE w.user_id = u.id AND ro.order_id = orders.id
                    )
                )
            )
        )
    );

-- 6. دوال مساعدة للتحقق من الصلاحيات (مصححة)
CREATE OR REPLACE FUNCTION check_user_permission(
    permission_type TEXT,
    action_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    has_permission BOOLEAN := FALSE;
BEGIN
    SELECT 
        COALESCE(
            (r.permissions->permission_type->>action_type)::BOOLEAN,
            (r.permissions->>'admin')::BOOLEAN,
            FALSE
        ) INTO has_permission
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid();
    
    RETURN COALESCE(has_permission, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة للحصول على صلاحيات المستخدم الحالي
CREATE OR REPLACE FUNCTION get_current_user_permissions()
RETURNS JSONB AS $$
DECLARE
    user_permissions JSONB;
BEGIN
    SELECT r.permissions INTO user_permissions
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid();
    
    RETURN COALESCE(user_permissions, '{}'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة للحصول على دور المستخدم الحالي
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT r.name INTO user_role
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid();
    
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. إنشاء فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_permissions ON roles USING GIN(permissions);

-- 8. تحديث المستخدمين الموجودين ليكون لهم دور افتراضي
UPDATE users 
SET role_id = (SELECT id FROM roles WHERE name = 'receptionist' LIMIT 1)
WHERE role_id IS NULL;

-- 9. تمكين RLS على بقية الجداول
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_performance ENABLE ROW LEVEL SECURITY;

-- 10. سياسات الجداول المتبقية اعتماداً على الدالة check_user_permission

-- الخدمات
DROP POLICY IF EXISTS "services_select" ON services;
DROP POLICY IF EXISTS "services_insert" ON services;
DROP POLICY IF EXISTS "services_update" ON services;
DROP POLICY IF EXISTS "services_delete" ON services;
CREATE POLICY "services_select" ON services FOR SELECT USING (check_user_permission('services','read'));
CREATE POLICY "services_insert" ON services FOR INSERT WITH CHECK (check_user_permission('services','create'));
CREATE POLICY "services_update" ON services FOR UPDATE USING (check_user_permission('services','update'));
CREATE POLICY "services_delete" ON services FOR DELETE USING (check_user_permission('services','delete'));

-- فئات الخدمات
DROP POLICY IF EXISTS "service_categories_select" ON service_categories;
DROP POLICY IF EXISTS "service_categories_insert" ON service_categories;
DROP POLICY IF EXISTS "service_categories_update" ON service_categories;
DROP POLICY IF EXISTS "service_categories_delete" ON service_categories;
CREATE POLICY "service_categories_select" ON service_categories FOR SELECT USING (check_user_permission('services','read'));
CREATE POLICY "service_categories_insert" ON service_categories FOR INSERT WITH CHECK (check_user_permission('services','create'));
CREATE POLICY "service_categories_update" ON service_categories FOR UPDATE USING (check_user_permission('services','update'));
CREATE POLICY "service_categories_delete" ON service_categories FOR DELETE USING (check_user_permission('services','delete'));

-- العمال
DROP POLICY IF EXISTS "workers_select" ON workers;
DROP POLICY IF EXISTS "workers_insert" ON workers;
DROP POLICY IF EXISTS "workers_update" ON workers;
DROP POLICY IF EXISTS "workers_delete" ON workers;
CREATE POLICY "workers_select" ON workers FOR SELECT USING (check_user_permission('workers','read'));
CREATE POLICY "workers_insert" ON workers FOR INSERT WITH CHECK (check_user_permission('workers','create'));
CREATE POLICY "workers_update" ON workers FOR UPDATE USING (check_user_permission('workers','update'));
CREATE POLICY "workers_delete" ON workers FOR DELETE USING (check_user_permission('workers','delete'));

-- الفرق
DROP POLICY IF EXISTS "teams_select" ON teams;
DROP POLICY IF EXISTS "teams_insert" ON teams;
DROP POLICY IF EXISTS "teams_update" ON teams;
DROP POLICY IF EXISTS "teams_delete" ON teams;
CREATE POLICY "teams_select" ON teams FOR SELECT USING (check_user_permission('teams','read'));
CREATE POLICY "teams_insert" ON teams FOR INSERT WITH CHECK (check_user_permission('teams','create'));
CREATE POLICY "teams_update" ON teams FOR UPDATE USING (check_user_permission('teams','update'));
CREATE POLICY "teams_delete" ON teams FOR DELETE USING (check_user_permission('teams','delete'));

-- أعضاء الفرق
DROP POLICY IF EXISTS "team_members_select" ON team_members;
DROP POLICY IF EXISTS "team_members_insert" ON team_members;
DROP POLICY IF EXISTS "team_members_update" ON team_members;
DROP POLICY IF EXISTS "team_members_delete" ON team_members;
CREATE POLICY "team_members_select" ON team_members FOR SELECT USING (check_user_permission('teams','read'));
CREATE POLICY "team_members_insert" ON team_members FOR INSERT WITH CHECK (check_user_permission('teams','update'));
CREATE POLICY "team_members_update" ON team_members FOR UPDATE USING (check_user_permission('teams','update'));
CREATE POLICY "team_members_delete" ON team_members FOR DELETE USING (check_user_permission('teams','update'));

-- عناصر الطلب
DROP POLICY IF EXISTS "order_items_select" ON order_items;
DROP POLICY IF EXISTS "order_items_insert" ON order_items;
DROP POLICY IF EXISTS "order_items_update" ON order_items;
DROP POLICY IF EXISTS "order_items_delete" ON order_items;
CREATE POLICY "order_items_select" ON order_items FOR SELECT USING (check_user_permission('orders','read'));
CREATE POLICY "order_items_insert" ON order_items FOR INSERT WITH CHECK (check_user_permission('orders','create'));
CREATE POLICY "order_items_update" ON order_items FOR UPDATE USING (check_user_permission('orders','update'));
CREATE POLICY "order_items_delete" ON order_items FOR DELETE USING (check_user_permission('orders','delete'));

-- سجلات حالة الطلب
DROP POLICY IF EXISTS "order_status_logs_select" ON order_status_logs;
DROP POLICY IF EXISTS "order_status_logs_insert" ON order_status_logs;
DROP POLICY IF EXISTS "order_status_logs_update" ON order_status_logs;
DROP POLICY IF EXISTS "order_status_logs_delete" ON order_status_logs;
CREATE POLICY "order_status_logs_select" ON order_status_logs FOR SELECT USING (check_user_permission('orders','read'));
CREATE POLICY "order_status_logs_insert" ON order_status_logs FOR INSERT WITH CHECK (check_user_permission('orders','update'));
CREATE POLICY "order_status_logs_update" ON order_status_logs FOR UPDATE USING (check_user_permission('orders','update'));
CREATE POLICY "order_status_logs_delete" ON order_status_logs FOR DELETE USING (check_user_permission('orders','update'));

-- خطوط السير
DROP POLICY IF EXISTS "routes_select" ON routes;
CREATE POLICY "routes_select" ON routes FOR SELECT USING (check_user_permission('routes','read'));
DROP POLICY IF EXISTS "routes_insert" ON routes;
DROP POLICY IF EXISTS "routes_update" ON routes;
DROP POLICY IF EXISTS "routes_delete" ON routes;
CREATE POLICY "routes_insert" ON routes FOR INSERT WITH CHECK (check_user_permission('routes','create'));
CREATE POLICY "routes_update" ON routes FOR UPDATE USING (check_user_permission('routes','update'));
CREATE POLICY "routes_delete" ON routes FOR DELETE USING (check_user_permission('routes','delete'));

-- route_orders
DROP POLICY IF EXISTS "route_orders_select" ON route_orders;
DROP POLICY IF EXISTS "route_orders_insert" ON route_orders;
DROP POLICY IF EXISTS "route_orders_update" ON route_orders;
DROP POLICY IF EXISTS "route_orders_delete" ON route_orders;
CREATE POLICY "route_orders_select" ON route_orders FOR SELECT USING (check_user_permission('routes','read'));
CREATE POLICY "route_orders_insert" ON route_orders FOR INSERT WITH CHECK (check_user_permission('routes','update'));
CREATE POLICY "route_orders_update" ON route_orders FOR UPDATE USING (check_user_permission('routes','update'));
CREATE POLICY "route_orders_delete" ON route_orders FOR DELETE USING (check_user_permission('routes','update'));

-- فئات المصروفات
DROP POLICY IF EXISTS "expense_categories_select" ON expense_categories;
DROP POLICY IF EXISTS "expense_categories_insert" ON expense_categories;
DROP POLICY IF EXISTS "expense_categories_update" ON expense_categories;
DROP POLICY IF EXISTS "expense_categories_delete" ON expense_categories;
CREATE POLICY "expense_categories_select" ON expense_categories FOR SELECT USING (check_user_permission('expenses','read'));
CREATE POLICY "expense_categories_insert" ON expense_categories FOR INSERT WITH CHECK (check_user_permission('expenses','create'));
CREATE POLICY "expense_categories_update" ON expense_categories FOR UPDATE USING (check_user_permission('expenses','update'));
CREATE POLICY "expense_categories_delete" ON expense_categories FOR DELETE USING (check_user_permission('expenses','delete'));

-- المصروفات
DROP POLICY IF EXISTS "expenses_select" ON expenses;
DROP POLICY IF EXISTS "expenses_insert" ON expenses;
DROP POLICY IF EXISTS "expenses_update" ON expenses;
DROP POLICY IF EXISTS "expenses_delete" ON expenses;
CREATE POLICY "expenses_select" ON expenses FOR SELECT USING (check_user_permission('expenses','read'));
CREATE POLICY "expenses_insert" ON expenses FOR INSERT WITH CHECK (check_user_permission('expenses','create'));
CREATE POLICY "expenses_update" ON expenses FOR UPDATE USING (check_user_permission('expenses','update'));
CREATE POLICY "expenses_delete" ON expenses FOR DELETE USING (check_user_permission('expenses','delete'));

-- التقارير اليومية
DROP POLICY IF EXISTS "daily_reports_select" ON daily_reports;
CREATE POLICY "daily_reports_select" ON daily_reports FOR SELECT USING (check_user_permission('reports','read'));

-- أداء الفريق
DROP POLICY IF EXISTS "team_performance_select" ON team_performance;
CREATE POLICY "team_performance_select" ON team_performance FOR SELECT USING (check_user_permission('reports','read'));

-- ============================================================
-- Users table policies (admin / users.* permissions)
-- Note: a select policy for users to view their own data is already present.
-- Enable CRUD operations for roles that have the appropriate users permissions
-- (admin role automatically passes via check_user_permission)
-- ============================================================

-- Ensure RLS is enabled (no-op if already enabled)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Clean up previous policies (except self-select one)
DROP POLICY IF EXISTS "users_insert"  ON users;
DROP POLICY IF EXISTS "users_update"  ON users;
DROP POLICY IF EXISTS "users_delete"  ON users;

-- Create new permission-driven policies
-- INSERT: only roles with users.create
CREATE POLICY "users_insert" ON users
  FOR INSERT
  WITH CHECK ( check_user_permission('users', 'create') );

-- UPDATE: only roles with users.update
CREATE POLICY "users_update" ON users
  FOR UPDATE
  USING ( check_user_permission('users', 'update') );

-- DELETE: only roles with users.delete
CREATE POLICY "users_delete" ON users
  FOR DELETE
  USING ( check_user_permission('users', 'delete') );

-- إعدادات النظام
DROP POLICY IF EXISTS "system_settings_select" ON system_settings;
DROP POLICY IF EXISTS "system_settings_update" ON system_settings;
CREATE POLICY "system_settings_select" ON system_settings FOR SELECT USING (check_user_permission('settings','read'));
CREATE POLICY "system_settings_update" ON system_settings FOR UPDATE USING (check_user_permission('settings','update'));









------------------------------------------------------------
-- ⚙️  تفعيل uuid-ossp (مرة واحدة فقط)
------------------------------------------------------------
create extension if not exists "uuid-ossp";

------------------------------------------------------------------------------------------------------------------------
-- 🔄 إعادة إنشاء create_user_with_role بالدالة الصحيحة
------------------------------------------------------------
drop function if exists create_user_with_role (
  p_email text,
  p_password text,
  p_full_name text,
  p_role_id uuid,
  p_phone text,
  p_is_active boolean
);

create or replace function create_user_with_role (
  p_email      text,
  p_password   text,
  p_full_name  text,
  p_role_id    uuid,
  p_phone      text default null,
  p_is_active  boolean default true
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_new_user auth.users;
begin
  -- 1) إنشاء حساب فى auth (الدالة الجديدة)
  select *
    into v_new_user
    from auth.create_user(
      email         := p_email,
      password      := p_password,
      email_confirm := true        -- تأكيد فورى
    );

  -- 2) إدخال صف فى جدول users
  insert into public.users (
    id, email, full_name, phone, role_id, is_active
  ) values (
    v_new_user.id, p_email, p_full_name, p_phone, p_role_id, p_is_active
  );
end;
$$;

grant execute on function create_user_with_role to authenticated, anon;
------------------------------------------------------------
-- ✏️  FUNCTION: update_user_with_role
------------------------------------------------------------
drop function if exists update_user_with_role (
  p_user_id uuid,
  p_full_name text,
  p_phone text,
  p_role_id uuid,
  p_is_active boolean
);

create or replace function update_user_with_role (
  p_user_id   uuid,
  p_full_name text default null,
  p_phone     text default null,
  p_role_id   uuid default null,
  p_is_active boolean default null
)
returns void
language plpgsql
security definer
as $$
begin
  update public.users
  set full_name  = coalesce(p_full_name, full_name),
      phone      = coalesce(p_phone, phone),
      role_id    = coalesce(p_role_id, role_id),
      is_active  = coalesce(p_is_active, is_active),
      updated_at = now()
  where id = p_user_id;
end;
$$;

grant execute on function update_user_with_role to authenticated, anon;

------------------------------------------------------------
-- ❌  FUNCTION: delete_user_and_auth
------------------------------------------------------------
drop function if exists delete_user_and_auth (p_user_id uuid);

create or replace function delete_user_and_auth (
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  delete from public.users where id = p_user_id;
  delete from auth.users   where id = p_user_id;
end;
$$;

grant execute on function delete_user_and_auth to authenticated, anon;





------------------------------------------------------------
-- 0) إضافة دور مبدئى محدود (إن لم يكن موجوداً)
------------------------------------------------------------
insert into roles (id, name, name_ar, permissions, description, is_active)
values (
  gen_random_uuid(),
  'pending',                     -- الاسم
  'مستخدم قيد المراجعة',        -- الاسم العربى
  '{}'::jsonb,                  -- كل الصلاحيات false
  'حساب تم إنشاؤه بانتظار موافقة الأدمن',
  true
)
on conflict (name) do nothing;   -- تجنّب التكرار

------------------------------------------------------------
-- 1) دالة-تريغر لملء جدول users بعد signUp
------------------------------------------------------------
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer           -- كى تعمل حتى لو RLS تمنع الإدراج
set search_path = public
as $$
begin
  insert into users (id, email, role_id, is_active)
  values (new.id, new.email, (select id from roles where name = 'pending'), true);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure handle_new_auth_user();





-- قبل التنفيذ احذف أى سياسات قديمة (إن وُجدت)
DROP POLICY IF EXISTS "orders_insert"  ON orders;
DROP POLICY IF EXISTS "orders_update"  ON orders;
DROP POLICY IF EXISTS "orders_delete"  ON orders;

-- INSERT: يُسمح للأدوار التى لديها orders.create
CREATE POLICY "orders_insert" ON orders
  FOR INSERT
  WITH CHECK (check_user_permission('orders', 'create'));

-- UPDATE: يُسمح للأدوار التى لديها orders.update
CREATE POLICY "orders_update" ON orders
  FOR UPDATE
  USING (check_user_permission('orders', 'update'));

-- DELETE: يُسمح للأدوار التى لديها orders.delete
CREATE POLICY "orders_delete" ON orders
  FOR DELETE
  USING (check_user_permission('orders', 'delete'));