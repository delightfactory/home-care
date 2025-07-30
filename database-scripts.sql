-- جدول الأدوار
CREATE TABLE roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    name_ar VARCHAR(100) NOT NULL,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إدراج الأدوار الأساسية
INSERT INTO roles (name, name_ar, permissions) VALUES
('manager', 'المدير العام', '{"all": true}'),
('operations_supervisor', 'مشرف العمليات', '{"orders": true, "teams": true, "reports": true, "expenses_limit": 500}'),
('receptionist', 'موظف الاستقبال', '{"customers": true, "orders": true, "invoices": true}'),
('team_leader', 'قائد الفريق', '{"team_orders": true, "expenses": true, "order_status": true}');

-- جدول المستخدمين (يربط مع Supabase Auth)
CREATE TABLE users (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    role_id UUID REFERENCES roles(id),
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- جدول العملاء
CREATE TABLE customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    area VARCHAR(100),
    location_coordinates POINT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- فهرس للبحث السريع
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_area ON customers(area);


-- جدول فئات الخدمات
CREATE TABLE service_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    name_ar VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول الخدمات
CREATE TABLE services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID REFERENCES service_categories(id),
    name VARCHAR(100) NOT NULL,
    name_ar VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    unit VARCHAR(50) DEFAULT 'service', -- service, hour, room, sqm
    estimated_duration INTEGER, -- بالدقائق
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إدراج فئات الخدمات الأساسية
INSERT INTO service_categories (name, name_ar) VALUES
('general_cleaning', 'تنظيف عام'),
('deep_cleaning', 'تنظيف عميق'),
('specialized_cleaning', 'تنظيف متخصص');



-- جدول العمال
CREATE TABLE workers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) UNIQUE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    hire_date DATE NOT NULL,
    salary DECIMAL(10,2),
    skills JSONB DEFAULT '[]', -- مصفوفة المهارات
    can_drive BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, vacation
    rating DECIMAL(3,2) DEFAULT 0.00,
    total_orders INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول الفرق
CREATE TABLE teams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    leader_id UUID REFERENCES workers(id),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول أعضاء الفرق
CREATE TABLE team_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, worker_id)
);



-- جدول الطلبات
CREATE TABLE orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id) NOT NULL,
    team_id UUID REFERENCES teams(id),
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, scheduled, in_progress, completed, cancelled
    total_amount DECIMAL(10,2) DEFAULT 0.00,
    transport_method VARCHAR(50), -- company_car, taxi, uber, public_transport
    transport_cost DECIMAL(10,2) DEFAULT 0.00,
    payment_status VARCHAR(20) DEFAULT 'unpaid', -- paid_cash, paid_card, unpaid
    payment_method VARCHAR(20), -- cash, card
    notes TEXT,
    customer_rating INTEGER CHECK (customer_rating >= 1 AND customer_rating <= 5),
    customer_feedback TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول تفاصيل الطلبات (الخدمات المطلوبة)
CREATE TABLE order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id),
    quantity DECIMAL(10,2) DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    notes TEXT
);

-- جدول حالات الطلب (تتبع التقدم)
CREATE TABLE order_status_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    notes TEXT,
    location_coordinates POINT,
    images JSONB DEFAULT '[]', -- مصفوفة روابط الصور
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- فهارس للأداء
CREATE INDEX idx_orders_date ON orders(scheduled_date);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_customer ON orders(customer_id);


-- جدول خطوط السير
CREATE TABLE routes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    team_id UUID REFERENCES teams(id),
    start_time TIME,
    estimated_end_time TIME,
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'planned', -- planned, in_progress, completed
    total_distance DECIMAL(10,2), -- بالكيلومتر
    total_estimated_time INTEGER, -- بالدقائق
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول طلبات خط السير (ترتيب الطلبات)
CREATE TABLE route_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    sequence_order INTEGER NOT NULL,
    estimated_arrival_time TIME,
    actual_arrival_time TIMESTAMP WITH TIME ZONE,
    estimated_completion_time TIME,
    actual_completion_time TIMESTAMP WITH TIME ZONE,
    UNIQUE(route_id, order_id),
    UNIQUE(route_id, sequence_order)
);




-- جدول فئات المصروفات
CREATE TABLE expense_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    name_ar VARCHAR(100) NOT NULL,
    description TEXT,
    requires_approval BOOLEAN DEFAULT false,
    approval_limit DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول المصروفات
CREATE TABLE expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID REFERENCES expense_categories(id),
    order_id UUID REFERENCES orders(id), -- اختياري - ربط بطلب معين
    route_id UUID REFERENCES routes(id), -- اختياري - ربط بخط سير
    team_id UUID REFERENCES teams(id),
    amount DECIMAL(10,2) NOT NULL,
    description TEXT NOT NULL,
    receipt_image_url TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إدراج فئات المصروفات الأساسية
INSERT INTO expense_categories (name, name_ar, requires_approval, approval_limit) VALUES
('fuel', 'وقود', false, 100.00),
('transport', 'مواصلات', false, 50.00),
('materials', 'مواد تنظيف', true, 200.00),
('maintenance', 'صيانة', true, 500.00),
('other', 'أخرى', true, 100.00);



-- جدول التقارير اليومية
CREATE TABLE daily_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_date DATE NOT NULL UNIQUE,
    total_orders INTEGER DEFAULT 0,
    completed_orders INTEGER DEFAULT 0,
    cancelled_orders INTEGER DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0.00,
    total_expenses DECIMAL(10,2) DEFAULT 0.00,
    net_profit DECIMAL(10,2) DEFAULT 0.00,
    active_teams INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    generated_by UUID REFERENCES users(id)
);

-- جدول إحصائيات الفرق
CREATE TABLE team_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id UUID REFERENCES teams(id),
    date DATE NOT NULL,
    orders_completed INTEGER DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0.00,
    total_expenses DECIMAL(10,2) DEFAULT 0.00,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    efficiency_score DECIMAL(5,2) DEFAULT 0.00, -- نسبة الإنجاز في الوقت المحدد
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, date)
);


-- جدول إعدادات النظام
CREATE TABLE system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إدراج الإعدادات الأساسية
INSERT INTO system_settings (key, value, description) VALUES
('transport_rates', '{"company_car": 0.5, "taxi": 2.0, "uber": 1.8, "public_transport": 0.3}', 'تكلفة المواصلات لكل كيلومتر'),
('working_hours', '{"start": "08:00", "end": "18:00"}', 'ساعات العمل'),
('order_number_prefix', '"ORD"', 'بادئة رقم الطلب'),
('company_info', '{"name": "شركة HOME CARE", "phone": "", "address": ""}', 'معلومات الشركة');


-- تفعيل Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- سياسة الوصول للمستخدمين
CREATE POLICY "Users can view their own data" ON users
    FOR ALL USING (auth.uid() = id);

-- سياسة الوصول للعملاء (حسب الدور)
CREATE POLICY "Authenticated users can view customers" ON customers
    FOR SELECT USING (auth.role() = 'authenticated');

-- سياسة الوصول للطلبات
CREATE POLICY "Users can view orders based on role" ON orders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users u 
            JOIN roles r ON u.role_id = r.id 
            WHERE u.id = auth.uid() 
            AND (r.name = 'manager' OR r.name = 'operations_supervisor' OR r.name = 'receptionist')
        )
    );


    
/*============================================================
= 1) فهارس مساعدة للأداء (تنشأ إذا لم تكن موجودة)       =
============================================================*/
CREATE INDEX IF NOT EXISTS idx_route_orders_order_id ON route_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_route_orders_route_id ON route_orders(route_id);
CREATE INDEX IF NOT EXISTS idx_routes_team_id        ON routes(team_id);

/*============================================================
= 2) دالة تحديث team_id لطلب واحد (Security Definer)      =
============================================================*/
CREATE OR REPLACE FUNCTION update_order_team(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER                -- تتجاوز سياسات RLS
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team_id UUID;
BEGIN
  /* الحصول على أحدث فريق مرتبط بالطلب (إن وُجد) */
  SELECT r.team_id
  INTO   v_team_id
  FROM   route_orders ro
  JOIN   routes r ON r.id = ro.route_id
  WHERE  ro.order_id = p_order_id
  ORDER  BY ro.created_at DESC       -- يفترض وجود created_at
  LIMIT  1;

  /* إذا لم يوجد خط سير، v_team_id ستكون NULL */
  UPDATE orders
  SET    team_id = v_team_id
  WHERE  id = p_order_id;
END;
$$;

-- منح حق الاستدعاء لدور authenticated فقط
GRANT EXECUTE ON FUNCTION update_order_team(UUID) TO authenticated;

/*============================================================
= 3) Trigger على route_orders (INSERT / UPDATE / DELETE)  =
============================================================*/
CREATE OR REPLACE FUNCTION trg_route_orders_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_order_team(OLD.order_id);
  ELSE
    PERFORM update_order_team(NEW.order_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS route_orders_sync_team ON route_orders;
CREATE TRIGGER route_orders_sync_team
AFTER INSERT OR UPDATE OR DELETE ON route_orders
FOR EACH ROW EXECUTE PROCEDURE trg_route_orders_sync();

/*============================================================
= 4) Trigger على routes لتحديث الطلبات عند تغيير الفريق =
============================================================*/
CREATE OR REPLACE FUNCTION trg_routes_team_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE orders
  SET    team_id = NEW.team_id
  WHERE  id IN (
    SELECT ro.order_id
    FROM   route_orders ro
    WHERE  ro.route_id = NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS routes_team_change ON routes;
CREATE TRIGGER routes_team_change
AFTER UPDATE OF team_id ON routes
FOR EACH ROW EXECUTE PROCEDURE trg_routes_team_change();

/*============================================================
= 5) مزامنة أولية للبيانات التاريخية (تشغَّل مرة واحدة)  =
============================================================*/
-- لإعادة ملء team_id للطلبات القديمة، أزل التعليقات وشغّل الجزء التالي
/*
UPDATE orders o
SET    team_id = sub.team_id
FROM (
  SELECT DISTINCT ON (ro.order_id) ro.order_id, r.team_id
  FROM   route_orders ro
  JOIN   routes r ON r.id = ro.route_id
  ORDER  BY ro.order_id, ro.created_at DESC
) sub
WHERE  o.id = sub.order_id;
*/

/*============================================================
= 6) اختبار اختياري بعد التنفيذ                            =
============================================================
-- مثال مختصر للاختبار موضح في السكربت السابق؛ يمكن تشغيله للتأكد من المزامنة.
*/




-- إضافة الأعمدة إن لم تكن موجودة
ALTER TABLE route_orders
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- فهرس اختياري للأداء
CREATE INDEX IF NOT EXISTS idx_route_orders_created_at ON route_orders(created_at);

-- استعلام المزامنة التاريخية (بعد إضافة العمود)
UPDATE orders o
SET    team_id = sub.team_id
FROM (
  SELECT DISTINCT ON (ro.order_id) ro.order_id, r.team_id
  FROM   route_orders ro
  JOIN   routes r ON r.id = ro.route_id
  ORDER  BY ro.order_id, ro.created_at DESC
) sub
WHERE  o.id = sub.order_id;






/*============================================================
=  Trigger: إعادة تعيين قائد الفريق عند حذفه/نقله        =
============================================================*/

-- 1) الدالّة
CREATE OR REPLACE FUNCTION trg_reset_leader_when_removed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER        -- لتمكين التنفيذ تحت صلاحيات المنشئ عند تفعيل RLS
AS $$
BEGIN
  /* عند الحذف */
  IF TG_OP = 'DELETE' THEN
    UPDATE teams
    SET    leader_id = NULL,
           updated_at = NOW()
    WHERE  id = OLD.team_id
      AND  leader_id = OLD.worker_id;

  /* عند النقل إلى فريق آخر (تغيّر team_id) */
  ELSIF TG_OP = 'UPDATE'
     AND NEW.team_id IS DISTINCT FROM OLD.team_id THEN
    UPDATE teams
    SET    leader_id = NULL,
           updated_at = NOW()
    WHERE  id = OLD.team_id          -- الفريق الأصلى
      AND  leader_id = OLD.worker_id;
  END IF;

  RETURN NULL;   -- AFTER trigger لا يحتاج إرجاع سجل
END;
$$;

-- 2) التريجر
DROP TRIGGER IF EXISTS team_members_reset_leader ON team_members;

CREATE TRIGGER team_members_reset_leader
AFTER DELETE OR UPDATE OF team_id ON team_members
FOR EACH ROW
EXECUTE PROCEDURE trg_reset_leader_when_removed();

-- 3) (اختياري) منح صلاحية التنفيذ لدور authenticated
GRANT EXECUTE ON FUNCTION trg_reset_leader_when_removed() TO authenticated;





/* ==============================================
   ميزة تأكيد الطلب مع العميل
   يضيف حقلاً للحالة + بيانات التوثيق
   ============================================== */

-- 1) إنشاء نوع ENUM للحالة (pending / confirmed / declined)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'confirmation_status_enum'
  ) THEN
    CREATE TYPE confirmation_status_enum AS ENUM ('pending', 'confirmed', 'declined');
  END IF;
END
$$;

-- 2) تعديل جدول الطلبات
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS confirmation_status confirmation_status_enum NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS confirmed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmation_notes TEXT;

-- 3) فهرس اختياري للأداء على حقل الحالة
CREATE INDEX IF NOT EXISTS idx_orders_confirmation_status
  ON orders (confirmation_status);

-- 4) تعليق توضيحي (اختياري)
COMMENT ON COLUMN orders.confirmation_status  IS 'حالة تأكيد الطلب مع العميل (معلّقة/مؤكَّدة/مرفوضة)';
COMMENT ON COLUMN orders.confirmed_at         IS 'تاريخ ووقت تأكيد أو رفض العميل';
COMMENT ON COLUMN orders.confirmed_by         IS 'معرّف المستخدم الذي قام بعملية التأكيد/الرفض';
COMMENT ON COLUMN orders.confirmation_notes   IS 'ملاحظات موظف الكول سنتر أثناء التأكيد أو الرفض';






-- إضافة الحقول (اختيارية = تسمح بقيم NULL)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS extra_phone     VARCHAR(20),  -- رقم تليفون إضافي
  ADD COLUMN IF NOT EXISTS referral_source TEXT;         -- كيف وصل العميل (نص حر)

-- توثيق الأعمدة (اختياري)
COMMENT ON COLUMN public.customers.extra_phone
  IS 'رقم تليفون إضافي للعميل (اختياري)';
COMMENT ON COLUMN public.customers.referral_source
  IS 'الطريقة التي وصل بها العميل إلى الشركة (نص حر)';

-- (اختياري) فهرس بحث سريع على رقم الهاتف الإضافي
CREATE INDEX IF NOT EXISTS idx_customers_extra_phone
  ON public.customers (extra_phone);





  /* =========================================================
= 0) إضافة left_at إلى team_members (إن لزم)             =
========================================================= */
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ;

/* ---------------------------------------------------------
   Trigger يمنع DELETE حقيقى ويحوّله إلى Update left_at
--------------------------------------------------------- */
CREATE OR REPLACE FUNCTION soft_delete_team_member()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  -- تحديث وقت المغادرة
  UPDATE team_members SET left_at = NOW()
  WHERE id = OLD.id;
  RETURN NULL;          -- إلغاء عملية الحذف
END;
$$;

DROP TRIGGER IF EXISTS team_member_soft_delete ON team_members;
CREATE TRIGGER team_member_soft_delete
BEFORE DELETE ON team_members
FOR EACH ROW EXECUTE FUNCTION soft_delete_team_member();

/* =========================================================
= 1) إنشاء جدول order_workers (نواة HR)                  =
========================================================= */
CREATE TABLE IF NOT EXISTS order_workers (
    -- مفتاح أساسى مستقل لتفادى أى تعارض مع NULL
    id              UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id        UUID NOT NULL   REFERENCES orders(id)  ON DELETE CASCADE,
    worker_id       UUID NOT NULL   REFERENCES workers(id) ON DELETE RESTRICT,
    team_id         UUID            REFERENCES teams(id),
    role            VARCHAR(20)     DEFAULT 'member',
    started_at      TIMESTAMPTZ     NOT NULL,
    finished_at     TIMESTAMPTZ,
    customer_rating SMALLINT        CHECK (customer_rating BETWEEN 1 AND 5),
    performance_score NUMERIC(5,2)
);

-- فهارس / قيود تفرد
CREATE UNIQUE INDEX IF NOT EXISTS ux_order_worker
  ON order_workers(order_id, worker_id);

CREATE INDEX IF NOT EXISTS idx_ow_worker     ON order_workers(worker_id);
CREATE INDEX IF NOT EXISTS idx_ow_started    ON order_workers(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ow_finished   ON order_workers(finished_at DESC);

/* =========================================================
= 2) دوال مزامنة مشاركة العمال                           =
========================================================= */
CREATE OR REPLACE FUNCTION populate_order_workers(p_order UUID, p_time TIMESTAMPTZ)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM order_workers WHERE order_id = p_order;

  INSERT INTO order_workers (order_id, worker_id, team_id, role, started_at)
  SELECT o.id,
         tm.worker_id,
         o.team_id,
         CASE WHEN tm.worker_id = t.leader_id THEN 'leader' ELSE 'member' END,
         p_time
  FROM orders o
  JOIN team_members tm ON tm.team_id = o.team_id
  JOIN teams t         ON t.id = o.team_id
  WHERE o.id = p_order
    AND (tm.left_at IS NULL OR tm.left_at >  p_time)
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION close_order_workers(p_order UUID, p_time TIMESTAMPTZ)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE order_workers
  SET finished_at     = p_time,
      customer_rating = o.customer_rating
  FROM orders o
  WHERE order_workers.order_id = p_order
    AND o.id = p_order
    AND order_workers.finished_at IS NULL;
END;
$$;

/* =========================================================
= 3) تريجر على order_status_logs فى حالتى in_progress/completed =
========================================================= */
CREATE OR REPLACE FUNCTION trg_ow_status_log()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'in_progress' THEN
      PERFORM populate_order_workers(NEW.order_id, NEW.created_at);
  ELSIF NEW.status = 'completed' THEN
      PERFORM close_order_workers(NEW.order_id, NEW.created_at);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_workers_sync ON order_status_logs;
CREATE TRIGGER order_workers_sync
AFTER INSERT ON order_status_logs
FOR EACH ROW EXECUTE FUNCTION trg_ow_status_log();

/* =========================================================
= 4) تريجر عند تحديث left_at لأحد أعضاء الفريق            =
========================================================= */
CREATE OR REPLACE FUNCTION trg_ow_team_member_left()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE order_workers
  SET finished_at = COALESCE(NEW.left_at, NOW())
  WHERE worker_id  = NEW.worker_id
    AND finished_at IS NULL
    AND started_at <= COALESCE(NEW.left_at, NOW());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ow_member_left ON team_members;
CREATE TRIGGER ow_member_left
AFTER UPDATE OF left_at ON team_members
FOR EACH ROW EXECUTE FUNCTION trg_ow_team_member_left();


/* =========================================================
= سياسات RLS لجدول order_workers (بدون IF NOT EXISTS)    =
========================================================= */

/* 1) احذف السياسات إن كانت موجودة لتجنُّب الخطأ عند إعادة التشغيل */
DROP POLICY IF EXISTS ow_select      ON order_workers;
DROP POLICY IF EXISTS ow_service_manage ON order_workers;

/* 2) فعّل RLS (لن يُكرَّر إذا كان مفعَّلاً مسبقاً) */
ALTER TABLE order_workers ENABLE ROW LEVEL SECURITY;

/* 3) أعد إنشاء السياسات */
CREATE POLICY ow_select
  ON order_workers
  FOR SELECT
  USING (TRUE);

CREATE POLICY ow_service_manage
  ON order_workers
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

/* 4) صلاحيات القراءة */
GRANT SELECT ON order_workers TO authenticated, anon;



/*═════════════════════════════════════════════════════════
=  سياسات مكمِّلة بدون المساس بالمنطق أو الهيكل          =
═════════════════════════════════════════════════════════*/

------------------------------------------------------------
-- 1) INSERT policy  (يعمل مع التريجر وأدوارك الإدارية)
------------------------------------------------------------
DROP POLICY IF EXISTS ow_insert_by_actor_or_admin ON public.order_workers;

CREATE POLICY ow_insert_by_actor_or_admin
ON public.order_workers
FOR INSERT
TO authenticated
WITH CHECK (
        /* ① أدوار الإدارة */
        EXISTS (
          SELECT 1
          FROM   public.users  u
          JOIN   public.roles  r ON r.id = u.role_id
          WHERE  u.id = auth.uid()
            AND  r.name IN ('manager','operations_supervisor','receptionist')
        )
     OR /* ② العامل أو القائد ضمن الفريق وقت التنفيذ */
        EXISTS (
          SELECT 1
          FROM   public.team_members tm
          WHERE  tm.team_id   = order_workers.team_id
            AND  tm.worker_id = (
                    SELECT w.id
                    FROM   public.workers w
                    WHERE  w.user_id = auth.uid()
                  )
            AND  (tm.left_at IS NULL OR tm.left_at > order_workers.started_at)
        )
);

------------------------------------------------------------
-- 2) UPDATE policy  (يغطّى finished_at / customer_rating)
------------------------------------------------------------
DROP POLICY IF EXISTS ow_update_by_actor_or_admin ON public.order_workers;

CREATE POLICY ow_update_by_actor_or_admin
ON public.order_workers
FOR UPDATE
TO authenticated
USING (
        /* يقرأ إذا كان إدارياً… */
        EXISTS (
          SELECT 1
          FROM   public.users u
          JOIN   public.roles r ON r.id = u.role_id
          WHERE  u.id = auth.uid()
            AND  r.name IN ('manager','operations_supervisor','receptionist')
        )
     OR /* …أو هو نفس العامل */
        order_workers.worker_id = (
          SELECT w.id
          FROM   public.workers w
          WHERE  w.user_id = auth.uid()
        )
)
WITH CHECK (TRUE);   -- يسمح بالتعديل طالما اجتاز شرط القراءة

------------------------------------------------------------
-- 3) (اختياري) فهرس يسرّع الشرط الثانى إذا لم يكن موجوداً
------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tm_team_worker
  ON public.team_members(team_id, worker_id);

/* =========================================================
= 5) تريجر مزامنة تقييم العميل إلى order_workers        =
========================================================= */

CREATE OR REPLACE FUNCTION sync_order_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- نفّذ فقط إذا تغيّر التقييم أو الملاحظات
  IF NEW.customer_rating IS DISTINCT FROM OLD.customer_rating
     OR NEW.customer_feedback IS DISTINCT FROM OLD.customer_feedback THEN

     UPDATE order_workers
     SET customer_rating = NEW.customer_rating
     WHERE order_id = NEW.id;

     -- TODO: يمكن لاحقاً حساب الأداء performance_score هنا
  END IF;

  RETURN NEW;
END;
$$;

-- احذف التريجر إن وُجد مسبقاً لتجنب التعارض عند إعادة النشر
DROP TRIGGER IF EXISTS order_rating_sync ON orders;

CREATE TRIGGER order_rating_sync
AFTER UPDATE OF customer_rating, customer_feedback ON orders
FOR EACH ROW
WHEN (pg_trigger_depth() = 0)
EXECUTE FUNCTION sync_order_rating();

-- (اختياري) امنح صلاحية تنفيذ الدالة للمستخدمين المصادق عليهم
GRANT EXECUTE ON FUNCTION sync_order_rating() TO authenticated;

