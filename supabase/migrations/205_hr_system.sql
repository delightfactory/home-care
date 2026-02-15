-- =====================================================================
-- Migration 205: HR System — الموارد البشرية
-- الحضور (GPS + يدوي) — الرواتب — السلف — التسويات — P&L
-- =====================================================================
--
-- 🔍 تحليل التعارضات:
-- ─────────────────────────────────────────────────────────────────────
-- الجدول     | التريجرات الحالية                  | الحالة المراقبة
-- ─────────────────────────────────────────────────────────────────────
-- orders     | trigger_auto_create_invoice         | completed
-- orders     | trigger_auto_cancel_invoice_on_order_cancel | cancelled
-- invoice_items | trigger_recalc_invoice_totals    | INSERT/UPDATE/DELETE
-- teams      | trigger_manage_custody_on_leader_change | UPDATE leader_id
-- ─────────────────────────────────────────────────────────────────────
-- التريجرات الجديدة:
-- ─────────────────────────────────────────────────────────────────────
-- orders     | trigger_auto_start_route            | in_progress (جديد ✅)
-- orders     | trigger_auto_complete_route          | completed/cancelled
-- routes     | trigger_auto_check_out              | completed (جديد ✅)
-- ─────────────────────────────────────────────────────────────────────
--
-- ⚠️ trigger_auto_complete_route يعمل على completed/cancelled مثل
--    التريجرات الحالية — لكن لا يوجد تعارض لأن:
--    - trigger_auto_create_invoice يعمل على جدول invoices
--    - trigger_auto_complete_route يعمل على جدول routes
--    - كل تريجر مستقل تماماً ويعمل على جداول مختلفة
--    - جميعهم AFTER UPDATE — لا يتنافسون على القفل
--
-- ⚠️ لا يوجد تريجر auto_check_in تلقائي على بدء الطلب
--    (تم إزالته لأنه يسجل حضور لكل أعضاء الفريق بما فيهم الغائبين)
--    الحضور يتم عبر: GPS من تطبيق الفني + يدوي من المشرف/الأدمن
--
-- ⚠️ هذا الملف يُنشئ جداول جديدة + يضيف عمود paid_leave_days لجدول workers
--
-- 📋 قواعد العمل:
--    - لا يوجد يوم إجازة ثابت (لا جمعة ولا سبت)
--    - كل أيام الشهر = أيام عمل
--    - كل عامل له 4 أيام إجازة مدفوعة/شهر (قابل للتعديل)
--    - أيام الغياب الفعلية = absent + leave
--    - الغياب غير المدفوع = أيام الغياب − الإجازات المسموحة (بحد أدنى 0)
--    - خصم الغياب = اليومية × الغياب غير المدفوع
-- =====================================================================


-- =====================================================================
-- PART 0: ALTER EXISTING TABLES — تعديلات بسيطة على الجداول الحالية
-- =====================================================================

-- إضافة عدد أيام الإجازة المدفوعة الشهرية لكل عامل (افتراضي: 4)
ALTER TABLE workers ADD COLUMN IF NOT EXISTS paid_leave_days INT NOT NULL DEFAULT 4;


-- =====================================================================
-- PART 1: HR TABLES — جداول الموارد البشرية
-- =====================================================================

-- ==================================
-- 1.1 سجلات الحضور والانصراف
-- ==================================
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- أوقات الحضور والانصراف
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,

  -- طريقة التسجيل
  check_in_method TEXT CHECK (check_in_method IN (
    'manual_gps', 'manual_admin'
  )),
  check_out_method TEXT CHECK (check_out_method IN (
    'auto_route_complete', 'manual_gps', 'manual_admin'
  )),

  -- الموقع الجغرافي (JSONB: {lat, lng, accuracy})
  check_in_location JSONB,
  check_out_location JSONB,

  -- الحالة
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN (
    'present', 'absent', 'late', 'leave', 'holiday'
  )),

  -- ساعات العمل المحسوبة تلقائياً
  work_hours NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN check_in_time IS NOT NULL AND check_out_time IS NOT NULL
      THEN ROUND(EXTRACT(EPOCH FROM (check_out_time - check_in_time)) / 3600.0, 2)
      ELSE NULL
    END
  ) STORED,

  -- ملاحظات وتعديلات
  notes TEXT,
  modified_by UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ⭐ سجل واحد لكل عامل لكل يوم
  UNIQUE(worker_id, date),

  -- ⭐ منع أوقات غير منطقية
  CONSTRAINT check_valid_times CHECK (
    check_out_time IS NULL OR check_in_time IS NULL
    OR check_out_time > check_in_time
  )
);

-- فهارس الحضور
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance_records(status);
CREATE INDEX IF NOT EXISTS idx_attendance_worker_date ON attendance_records(worker_id, date);


-- ==================================
-- 1.2 إعدادات موقع الشركة (للتحقق من GPS عند الحضور)
-- ==================================
CREATE TABLE IF NOT EXISTS company_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  radius_meters INT NOT NULL DEFAULT 200,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ==================================
-- 1.3 مسيرات الرواتب الشهرية
-- ==================================
CREATE TABLE IF NOT EXISTS payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL CHECK (year >= 2024),

  -- الحالة
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'calculated', 'approved'
  )),

  -- إجماليات
  total_salaries NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_incentives NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_penalties NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_bonuses NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_advances NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_absence_deductions NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_total NUMERIC(14,2) NOT NULL DEFAULT 0,

  -- الاعتماد
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,

  -- ربط بالمصروف (يُملأ عند الاعتماد)
  expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- مسير واحد لكل شهر
  UNIQUE(month, year)
);

CREATE INDEX IF NOT EXISTS idx_payroll_periods_status ON payroll_periods(status);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_month_year ON payroll_periods(month, year);


-- ==================================
-- 1.4 بنود الراتب (لكل عامل في المسير)
-- ==================================
CREATE TABLE IF NOT EXISTS payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,

  -- الراتب الأساسي
  base_salary NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- أيام الشهر والحضور
  total_month_days INT NOT NULL DEFAULT 30,       -- إجمالي أيام الشهر (28-31)
  paid_leave_allowance INT NOT NULL DEFAULT 4,    -- الإجازات المدفوعة المسموحة
  work_days INT NOT NULL DEFAULT 0,               -- أيام الحضور الفعلية (present + late)
  absent_days INT NOT NULL DEFAULT 0,             -- أيام الغياب (absent)
  leave_days INT NOT NULL DEFAULT 0,              -- أيام الإجازة (leave)
  late_days INT NOT NULL DEFAULT 0,               -- أيام التأخير (late)
  holiday_days INT NOT NULL DEFAULT 0,            -- أيام العطلات الرسمية (holiday)

  -- ⭐ خصم الغياب التلقائي
  -- الغياب غير المدفوع = (absent + leave) − paid_leave_allowance (بحد أدنى 0)
  -- الخصم = (الراتب ÷ أيام الشهر) × الغياب غير المدفوع
  unpaid_absent_days INT NOT NULL DEFAULT 0,
  daily_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  absence_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- الحوافز المحسوبة من calculate_worker_bonuses
  calculated_bonus NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- التسويات اليدوية
  manual_incentives NUMERIC(12,2) NOT NULL DEFAULT 0,
  manual_deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  manual_penalties NUMERIC(12,2) NOT NULL DEFAULT 0,
  manual_bonuses NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- خصم السلف
  advance_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- الصافي
  net_salary NUMERIC(12,2) NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- عامل واحد لكل مسير
  UNIQUE(payroll_period_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_items_period ON payroll_items(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_worker ON payroll_items(worker_id);


-- ==================================
-- 1.5 السلف
-- ==================================
CREATE TABLE IF NOT EXISTS salary_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,

  -- نوع السلفة
  advance_type TEXT NOT NULL CHECK (advance_type IN ('immediate', 'installment')),

  -- المبالغ
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  installments_count INT NOT NULL DEFAULT 1 CHECK (installments_count >= 1),
  installment_amount NUMERIC(12,2) NOT NULL CHECK (installment_amount > 0),
  remaining_amount NUMERIC(12,2) NOT NULL CHECK (remaining_amount >= 0),

  -- التوقيت
  start_month INT NOT NULL CHECK (start_month BETWEEN 1 AND 12),
  start_year INT NOT NULL CHECK (start_year >= 2024),

  -- الحالة
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'completed', 'cancelled'
  )),

  reason TEXT,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advances_worker ON salary_advances(worker_id);
CREATE INDEX IF NOT EXISTS idx_advances_status ON salary_advances(status);


-- ==================================
-- 1.6 أقساط السلف
-- ==================================
CREATE TABLE IF NOT EXISTS advance_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_id UUID NOT NULL REFERENCES salary_advances(id) ON DELETE CASCADE,

  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL CHECK (year >= 2024),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),

  -- الحالة
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'deducted', 'skipped'
  )),

  -- ربط بالمسير عند الخصم
  payroll_item_id UUID REFERENCES payroll_items(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- قسط واحد لكل سلفة لكل شهر
  UNIQUE(advance_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_installments_advance ON advance_installments(advance_id);
CREATE INDEX IF NOT EXISTS idx_installments_month_year ON advance_installments(month, year);
CREATE INDEX IF NOT EXISTS idx_installments_status ON advance_installments(status);


-- ==================================
-- 1.7 التسويات اليدوية (خصومات/جزاءات/مكافآت)
-- ==================================
CREATE TABLE IF NOT EXISTS hr_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,

  -- النوع
  type TEXT NOT NULL CHECK (type IN ('deduction', 'penalty', 'bonus')),

  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- ربط بالمسير عند المعالجة
  payroll_item_id UUID REFERENCES payroll_items(id) ON DELETE SET NULL,
  is_processed BOOLEAN NOT NULL DEFAULT false,

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adjustments_worker ON hr_adjustments(worker_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_type ON hr_adjustments(type);
CREATE INDEX IF NOT EXISTS idx_adjustments_date ON hr_adjustments(date DESC);
CREATE INDEX IF NOT EXISTS idx_adjustments_processed ON hr_adjustments(is_processed);


-- =====================================================================
-- PART 2: ROUTE AUTOMATION TRIGGERS — تريجرات خط السير
-- =====================================================================

-- ==================================
-- 2.1 بدء خط السير تلقائياً عند بدء أول طلب
-- ==================================
CREATE OR REPLACE FUNCTION auto_start_route_on_first_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_route_id UUID;
  v_route_status TEXT;
BEGIN
  IF NEW.status <> 'in_progress' OR OLD.status = 'in_progress' THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT ro.route_id INTO v_route_id
    FROM route_orders ro
    WHERE ro.order_id = NEW.id
    LIMIT 1;

    IF v_route_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT status INTO v_route_status
    FROM routes
    WHERE id = v_route_id;

    IF v_route_status IN ('planned', 'pending') THEN
      UPDATE routes
      SET status = 'in_progress',
          actual_start_time = NOW(),
          updated_at = NOW()
      WHERE id = v_route_id;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_start_route failed for order %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_start_route ON orders;
CREATE TRIGGER trigger_auto_start_route
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'in_progress' AND OLD.status IS DISTINCT FROM 'in_progress')
  EXECUTE FUNCTION auto_start_route_on_first_order();


-- ==================================
-- 2.2 إكمال خط السير تلقائياً عند إكمال/إلغاء آخر طلب
-- ==================================
CREATE OR REPLACE FUNCTION auto_complete_route_on_last_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_route_id UUID;
  v_total_orders INT;
  v_finished_orders INT;
BEGIN
  IF NEW.status NOT IN ('completed', 'cancelled') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT ro.route_id INTO v_route_id
    FROM route_orders ro
    WHERE ro.order_id = NEW.id
    LIMIT 1;

    IF v_route_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO v_total_orders
    FROM route_orders
    WHERE route_id = v_route_id;

    SELECT COUNT(*) INTO v_finished_orders
    FROM route_orders ro
    JOIN orders o ON o.id = ro.order_id
    WHERE ro.route_id = v_route_id
      AND o.status IN ('completed', 'cancelled');

    IF v_finished_orders >= v_total_orders AND v_total_orders > 0 THEN
      UPDATE routes
      SET status = 'completed',
          actual_end_time = NOW(),
          updated_at = NOW()
      WHERE id = v_route_id
        AND status IN ('in_progress', 'planned', 'pending');
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_complete_route failed for order %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_complete_route ON orders;
CREATE TRIGGER trigger_auto_complete_route
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status IN ('completed', 'cancelled') AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION auto_complete_route_on_last_order();


-- ==================================
-- 2.3 تسجيل الانصراف التلقائي عند إكمال خط السير
-- ==================================
CREATE OR REPLACE FUNCTION auto_check_out_on_route_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker RECORD;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  IF NEW.team_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    FOR v_worker IN
      SELECT ar.id AS attendance_id
      FROM attendance_records ar
      JOIN team_members tm ON tm.worker_id = ar.worker_id
      WHERE tm.team_id = NEW.team_id
        AND tm.left_at IS NULL
        AND ar.date = CURRENT_DATE
        AND ar.check_in_time IS NOT NULL
        AND ar.check_out_time IS NULL
    LOOP
      UPDATE attendance_records
      SET check_out_time = NOW(),
          check_out_method = 'auto_route_complete',
          updated_at = NOW()
      WHERE id = v_worker.attendance_id;
    END LOOP;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_check_out failed for route %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_check_out ON routes;
CREATE TRIGGER trigger_auto_check_out
  AFTER UPDATE OF status ON routes
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION auto_check_out_on_route_complete();


-- =====================================================================
-- PART 3: RPC FUNCTIONS — دوال الحساب
-- =====================================================================

-- ==================================
-- 3.1 حساب مسير الرواتب
-- ==================================
-- 📋 قواعد الحساب:
--   1. كل أيام الشهر = أيام عمل (لا يوجد يوم إجازة ثابت)
--   2. كل عامل له عدد أيام إجازة مدفوعة (workers.paid_leave_days، افتراضي: 4)
--   3. أيام الغياب الفعلية = أيام "absent" + أيام "leave"
--   4. الغياب غير المدفوع = MAX(0, أيام_الغياب − الإجازات_المسموحة)
--   5. اليومية = الراتب ÷ أيام الشهر
--   6. خصم الغياب = اليومية × الغياب غير المدفوع
--   7. أيام holiday لا تُحسب من الغياب (عطلة رسمية)
--
-- 📌 مثال: راتب 5000، شهر 30 يوم، 4 إجازات مسموحة
--   - غاب 6 أيام → غير مدفوع = 6 - 4 = 2
--   - اليومية = 5000 / 30 = 166.67
--   - خصم = 166.67 × 2 = 333.33
--   - الصافي = 5000 - 333.33 + حوافز - خصومات - سلف
-- ==================================
CREATE OR REPLACE FUNCTION calculate_payroll(
  p_month INT,
  p_year INT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_id UUID;
  v_period_status TEXT;
  v_worker RECORD;
  v_work_days INT;
  v_absent_days INT;
  v_leave_days INT;
  v_late_days INT;
  v_holiday_days INT;
  v_total_month_days INT;
  v_elapsed_days INT;  -- ⭐ الأيام المنقضية فعلياً (حماية من الحساب منتصف الشهر)
  v_paid_leave_allowance INT;
  v_actual_days_off INT;  -- ⭐ أيام عدم الحضور الفعلية
  v_unpaid_absent_days INT;
  v_daily_rate NUMERIC(12,2);
  v_absence_deduction NUMERIC(12,2);
  v_calculated_bonus NUMERIC(12,2);
  v_manual_incentives NUMERIC(12,2);
  v_manual_deductions NUMERIC(12,2);
  v_manual_penalties NUMERIC(12,2);
  v_manual_bonuses NUMERIC(12,2);
  v_advance_deduction NUMERIC(12,2);
  v_net_salary NUMERIC(12,2);
  v_total_salaries NUMERIC(14,2) := 0;
  v_total_incentives NUMERIC(14,2) := 0;
  v_total_deductions NUMERIC(14,2) := 0;
  v_total_penalties NUMERIC(14,2) := 0;
  v_total_bonuses NUMERIC(14,2) := 0;
  v_total_advances NUMERIC(14,2) := 0;
  v_total_absence NUMERIC(14,2) := 0;
  v_net_total NUMERIC(14,2) := 0;
  v_month_start DATE;
  v_month_end DATE;
BEGIN
  -- التحقق من عدم وجود مسير معتمد أو مصروف مسبقاً
  SELECT status INTO v_period_status
  FROM payroll_periods
  WHERE month = p_month AND year = p_year;

  IF v_period_status IN ('approved', 'partially_paid', 'paid') THEN
    RAISE EXCEPTION 'لا يمكن إعادة حساب مسير معتمد أو مصروف. شهر %/% حالته: %', p_month, p_year, v_period_status;
  END IF;

  -- حساب نطاق الشهر
  v_month_start := MAKE_DATE(p_year, p_month, 1);
  v_month_end := (v_month_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  -- ⭐ إجمالي أيام الشهر (كل الأيام = أيام عمل — لا يوجد إجازة أسبوعية ثابتة)
  v_total_month_days := EXTRACT(DAY FROM v_month_end)::INT;

  -- إنشاء أو تحديث المسير
  INSERT INTO payroll_periods (month, year, status)
  VALUES (p_month, p_year, 'calculated')
  ON CONFLICT (month, year) DO UPDATE
    SET status = 'calculated',
        updated_at = NOW()
  RETURNING id INTO v_period_id;

  -- حذف البنود القديمة (إعادة حساب)
  DELETE FROM payroll_items WHERE payroll_period_id = v_period_id;

  -- حساب لكل عامل نشط
  FOR v_worker IN
    SELECT w.id, w.salary, COALESCE(w.paid_leave_days, 4) AS paid_leave_days
    FROM workers w
    WHERE w.status = 'active'
      AND w.salary IS NOT NULL
      AND w.salary > 0
  LOOP
    -- ⭐ الإجازات المدفوعة المسموحة لهذا العامل
    v_paid_leave_allowance := v_worker.paid_leave_days;

    -- بيانات الحضور من سجلات attendance_records
    SELECT
      COALESCE(COUNT(*) FILTER (WHERE status IN ('present', 'late')), 0),
      COALESCE(COUNT(*) FILTER (WHERE status = 'absent'), 0),
      COALESCE(COUNT(*) FILTER (WHERE status = 'leave'), 0),
      COALESCE(COUNT(*) FILTER (WHERE status = 'late'), 0),
      COALESCE(COUNT(*) FILTER (WHERE status = 'holiday'), 0)
    INTO v_work_days, v_absent_days, v_leave_days, v_late_days, v_holiday_days
    FROM attendance_records
    WHERE worker_id = v_worker.id
      AND date BETWEEN v_month_start AND v_month_end;

    -- ⭐ حساب الأيام المنقضية فعلياً (حماية من حساب المسير منتصف الشهر)
    -- لو الشهر لسه ما خلصش، نحسب فقط لحد اليوم الحالى
    v_elapsed_days := LEAST(
      v_total_month_days,
      GREATEST(0, (CURRENT_DATE - v_month_start)::INT + 1)
    );

    -- ⭐ حساب خصم الغياب — بناءً على أيام عدم الحضور الفعلية
    -- أيام عدم الحضور = الأيام المنقضية − أيام الحضور الفعلى − العطلات
    -- هذا يضمن أن العامل بدون سجلات حضور يُخصم منه كل الأيام
    v_actual_days_off := GREATEST(0, v_elapsed_days - v_work_days - v_holiday_days);

    -- الغياب غير المدفوع = ما يزيد عن الإجازات المسموحة
    v_unpaid_absent_days := GREATEST(0, v_actual_days_off - v_paid_leave_allowance);

    -- اليومية = الراتب ÷ أيام الشهر
    v_daily_rate := ROUND(COALESCE(v_worker.salary, 0)::NUMERIC / GREATEST(v_total_month_days, 1), 2);

    -- خصم الغياب = اليومية × الغياب غير المدفوع
    v_absence_deduction := ROUND(v_daily_rate * v_unpaid_absent_days, 2);

    -- ⭐ الحوافز المحسوبة من calculate_worker_bonuses
    -- نستخدم base_bonus (الحافز الفعلى) بدلاً من final_bonus (المعتمد على التقييم)
    -- لأن نسبة تغطية التقييمات منخفضة جداً (~2%) مما يجعل final_bonus = 0 دائماً
    v_calculated_bonus := 0;
    BEGIN
      SELECT COALESCE(base_bonus, 0) INTO v_calculated_bonus
      FROM calculate_worker_bonuses(v_month_start)
      WHERE worker_id = v_worker.id;
    EXCEPTION WHEN OTHERS THEN
      v_calculated_bonus := 0;
    END;
    v_calculated_bonus := COALESCE(v_calculated_bonus, 0);

    -- التسويات اليدوية (غير المعالجة لهذا الشهر)
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE type = 'bonus'), 0),
      COALESCE(SUM(amount) FILTER (WHERE type = 'deduction'), 0),
      COALESCE(SUM(amount) FILTER (WHERE type = 'penalty'), 0)
    INTO v_manual_bonuses, v_manual_deductions, v_manual_penalties
    FROM hr_adjustments
    WHERE worker_id = v_worker.id
      AND date BETWEEN v_month_start AND v_month_end
      AND is_processed = false;

    v_manual_incentives := v_calculated_bonus + COALESCE(v_manual_bonuses, 0);

    -- أقساط السلف المستحقة هذا الشهر
    SELECT COALESCE(SUM(ai.amount), 0)
    INTO v_advance_deduction
    FROM advance_installments ai
    JOIN salary_advances sa ON sa.id = ai.advance_id
    WHERE sa.worker_id = v_worker.id
      AND sa.status = 'active'
      AND ai.month = p_month
      AND ai.year = p_year
      AND ai.status = 'pending';

    -- ⭐ حساب الصافي
    -- الصافي = الراتب + حوافز − خصم_الغياب − خصومات − جزاءات − سلف
    v_net_salary := COALESCE(v_worker.salary, 0)
                  + COALESCE(v_manual_incentives, 0)
                  - v_absence_deduction
                  - COALESCE(v_manual_deductions, 0)
                  - COALESCE(v_manual_penalties, 0)
                  - COALESCE(v_advance_deduction, 0);

    -- إدراج بند الراتب
    INSERT INTO payroll_items (
      payroll_period_id, worker_id,
      base_salary, total_month_days, paid_leave_allowance,
      work_days, absent_days, leave_days, late_days, holiday_days,
      unpaid_absent_days, daily_rate, absence_deduction,
      calculated_bonus,
      manual_incentives, manual_deductions, manual_penalties, manual_bonuses,
      advance_deduction, net_salary
    ) VALUES (
      v_period_id, v_worker.id,
      COALESCE(v_worker.salary, 0), v_total_month_days, v_paid_leave_allowance,
      v_work_days, v_absent_days, v_leave_days, v_late_days, v_holiday_days,
      v_unpaid_absent_days, v_daily_rate, v_absence_deduction,
      v_calculated_bonus,
      COALESCE(v_manual_incentives, 0), COALESCE(v_manual_deductions, 0),
      COALESCE(v_manual_penalties, 0), COALESCE(v_manual_bonuses, 0),
      COALESCE(v_advance_deduction, 0), v_net_salary
    );

    -- تجميع الإجماليات
    v_total_salaries := v_total_salaries + COALESCE(v_worker.salary, 0);
    v_total_incentives := v_total_incentives + COALESCE(v_manual_incentives, 0);
    v_total_deductions := v_total_deductions + COALESCE(v_manual_deductions, 0);
    v_total_penalties := v_total_penalties + COALESCE(v_manual_penalties, 0);
    v_total_bonuses := v_total_bonuses + COALESCE(v_manual_bonuses, 0);
    v_total_advances := v_total_advances + COALESCE(v_advance_deduction, 0);
    v_total_absence := v_total_absence + v_absence_deduction;
    v_net_total := v_net_total + v_net_salary;
  END LOOP;

  -- تحديث إجماليات المسير
  UPDATE payroll_periods
  SET total_salaries = v_total_salaries,
      total_incentives = v_total_incentives,
      total_deductions = v_total_deductions,
      total_penalties = v_total_penalties,
      total_bonuses = v_total_bonuses,
      total_advances = v_total_advances,
      total_absence_deductions = v_total_absence,
      net_total = v_net_total,
      updated_at = NOW()
  WHERE id = v_period_id;

  RETURN v_period_id;
END;
$$;


-- ==================================
-- 3.2 اعتماد مسير الرواتب (قفل الحسابات فقط — بدون صرف)
-- ==================================
-- الاعتماد = تأكيد وقفل الحسابات + معالجة التسويات والأقساط
-- الصرف الفعلى (الخصم من الخزنة) يتم عبر disburse_payroll
CREATE OR REPLACE FUNCTION approve_payroll(
  p_period_id UUID,
  p_approved_by UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period RECORD;
  v_item RECORD;
BEGIN
  -- جلب المسير
  SELECT * INTO v_period
  FROM payroll_periods
  WHERE id = p_period_id
    AND status = 'calculated';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'المسير غير موجود أو ليس بحالة "محسوب". يجب حساب المسير أولاً';
  END IF;

  -- التحقق من أن الصافي > 0
  IF v_period.net_total <= 0 THEN
    RAISE EXCEPTION 'لا يمكن اعتماد مسير بصافي صفر أو أقل';
  END IF;

  -- تحديث حالة المسير → معتمد
  UPDATE payroll_periods
  SET status = 'approved',
      approved_by = p_approved_by,
      approved_at = NOW(),
      updated_at = NOW()
  WHERE id = p_period_id;

  -- تحديث حالة التسويات (وضعها كمعالجة)
  UPDATE hr_adjustments
  SET is_processed = true,
      updated_at = NOW()
  WHERE worker_id IN (SELECT worker_id FROM payroll_items WHERE payroll_period_id = p_period_id)
    AND is_processed = false
    AND date BETWEEN
      MAKE_DATE(v_period.year, v_period.month, 1)
      AND (MAKE_DATE(v_period.year, v_period.month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  -- تحديث حالة أقساط السلف (وضعها كمخصومة)
  FOR v_item IN
    SELECT pi.id AS payroll_item_id, pi.worker_id
    FROM payroll_items pi
    WHERE pi.payroll_period_id = p_period_id
      AND pi.advance_deduction > 0
  LOOP
    UPDATE advance_installments ai
    SET status = 'deducted',
        payroll_item_id = v_item.payroll_item_id,
        updated_at = NOW()
    FROM salary_advances sa
    WHERE ai.advance_id = sa.id
      AND sa.worker_id = v_item.worker_id
      AND sa.status = 'active'
      AND ai.month = v_period.month
      AND ai.year = v_period.year
      AND ai.status = 'pending';

    -- ⭐ FIX: GREATEST(0, ...) لمنع القيم السالبة
    UPDATE salary_advances sa
    SET remaining_amount = GREATEST(0, remaining_amount - (
      SELECT COALESCE(SUM(ai.amount), 0)
      FROM advance_installments ai
      WHERE ai.advance_id = sa.id
        AND ai.month = v_period.month
        AND ai.year = v_period.year
        AND ai.status = 'deducted'
    )),
    updated_at = NOW()
    WHERE sa.worker_id = v_item.worker_id
      AND sa.status = 'active';

    -- إكمال السلف إذا تم سداد الكامل
    UPDATE salary_advances
    SET status = 'completed',
        updated_at = NOW()
    WHERE worker_id = v_item.worker_id
      AND status = 'active'
      AND remaining_amount <= 0;
  END LOOP;

  RETURN true;
END;
$$;


-- ==================================
-- 3.2.1 صرف الرواتب (خصم من الخزنة — يدعم الصرف الجزئى)
-- ==================================
-- يخصم المبلغ المحدد من الخزنة + يسجل مصروف + حركة خزنة
-- يمكن استدعاؤه أكثر من مرة لنفس المسير (صرف على دفعات)
CREATE OR REPLACE FUNCTION disburse_payroll(
  p_period_id UUID,
  p_vault_id UUID,
  p_amount NUMERIC,
  p_disbursed_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period RECORD;
  v_vault RECORD;
  v_remaining NUMERIC(14,2);
  v_new_balance NUMERIC(14,2);
  v_new_disbursed NUMERIC(14,2);
  v_expense_id UUID;
  v_category_id UUID;
  v_disbursement_id UUID;
  v_new_status TEXT;
BEGIN
  -- 1. جلب المسير والتحقق من حالته
  SELECT * INTO v_period
  FROM payroll_periods
  WHERE id = p_period_id
  FOR UPDATE;

  IF v_period IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'المسير غير موجود');
  END IF;

  IF v_period.status NOT IN ('approved', 'partially_paid') THEN
    RETURN jsonb_build_object('success', false, 'error',
      'لا يمكن الصرف — المسير يجب أن يكون معتمد أو مصروف جزئياً. الحالة الحالية: ' || v_period.status);
  END IF;

  -- 2. حساب المبلغ المتبقى
  v_remaining := v_period.net_total - COALESCE(v_period.total_disbursed, 0);

  IF v_remaining <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'المسير مصروف بالكامل بالفعل');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'المبلغ يجب أن يكون أكبر من صفر');
  END IF;

  IF p_amount > v_remaining THEN
    RETURN jsonb_build_object('success', false, 'error',
      'المبلغ المطلوب (' || p_amount || ') أكبر من المتبقى (' || v_remaining || ')',
      'remaining', v_remaining);
  END IF;

  -- 3. جلب الخزنة والتحقق من الرصيد
  SELECT * INTO v_vault FROM vaults WHERE id = p_vault_id FOR UPDATE;

  IF v_vault IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الخزنة غير موجودة');
  END IF;

  IF NOT v_vault.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'الخزنة غير نشطة');
  END IF;

  IF v_vault.balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'رصيد الخزنة غير كافٍ',
      'code', 'INSUFFICIENT_BALANCE',
      'vault_balance', v_vault.balance,
      'required_amount', p_amount
    );
  END IF;

  -- 4. خصم المبلغ من الخزنة
  v_new_balance := v_vault.balance - p_amount;

  UPDATE vaults
  SET balance = v_new_balance,
      updated_at = NOW()
  WHERE id = p_vault_id;

  -- 5. تسجيل حركة الخزنة
  INSERT INTO vault_transactions (
    vault_id, type, amount, notes,
    reference_type, reference_id,
    balance_after,
    performed_by
  ) VALUES (
    p_vault_id,
    'withdrawal',
    p_amount,
    'صرف رواتب شهر ' || v_period.month || '/' || v_period.year,
    'payroll',
    p_period_id,
    v_new_balance,
    p_disbursed_by
  );

  -- 6. البحث عن أو إنشاء فئة المصروف "رواتب"
  SELECT id INTO v_category_id
  FROM expense_categories
  WHERE name = 'salaries'
  LIMIT 1;

  IF v_category_id IS NULL THEN
    INSERT INTO expense_categories (name, name_ar, description, requires_approval, is_active)
    VALUES ('salaries', 'رواتب', 'مسيرات رواتب العمال', false, true)
    RETURNING id INTO v_category_id;
  END IF;

  -- 7. إنشاء مصروف بالمبلغ المصروف
  INSERT INTO expenses (
    category_id,
    amount,
    description,
    status,
    approved_by,
    approved_at,
    created_by
  ) VALUES (
    v_category_id,
    p_amount,
    'صرف رواتب شهر ' || v_period.month || '/' || v_period.year
      || CASE
          WHEN COALESCE(v_period.total_disbursed, 0) > 0
          THEN ' (دفعة إضافية)'
          WHEN p_amount < v_remaining
          THEN ' (دفعة جزئية)'
          ELSE ''
        END,
    'approved',
    p_disbursed_by,
    NOW(),
    p_disbursed_by
  )
  RETURNING id INTO v_expense_id;

  -- 8. تسجيل دفعة الصرف
  INSERT INTO payroll_disbursements (
    payroll_period_id, vault_id, amount,
    expense_id, disbursed_by
  ) VALUES (
    p_period_id, p_vault_id, p_amount,
    v_expense_id, p_disbursed_by
  )
  RETURNING id INTO v_disbursement_id;

  -- 9. تحديث إجمالى المصروف وحالة المسير
  v_new_disbursed := COALESCE(v_period.total_disbursed, 0) + p_amount;

  IF v_new_disbursed >= v_period.net_total THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partially_paid';
  END IF;

  UPDATE payroll_periods
  SET total_disbursed = v_new_disbursed,
      status = v_new_status,
      expense_id = v_expense_id,
      updated_at = NOW()
  WHERE id = p_period_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', CASE v_new_status
      WHEN 'paid' THEN 'تم صرف المسير بالكامل'
      ELSE 'تم صرف دفعة جزئية — المتبقى: ' || (v_period.net_total - v_new_disbursed)
    END,
    'disbursement_id', v_disbursement_id,
    'amount_disbursed', p_amount,
    'total_disbursed', v_new_disbursed,
    'remaining', v_period.net_total - v_new_disbursed,
    'new_vault_balance', v_new_balance,
    'new_status', v_new_status
  );
END;
$$;


-- ==================================
-- 3.3 تقرير الأرباح والخسائر
-- ==================================
CREATE OR REPLACE FUNCTION get_profit_loss_report(
  p_date_from DATE,
  p_date_to DATE
)
RETURNS TABLE (
  total_revenue NUMERIC(14,2),
  total_expenses NUMERIC(14,2),
  total_payroll NUMERIC(14,2),
  net_profit NUMERIC(14,2),
  revenue_details JSONB,
  expense_details JSONB,
  payroll_details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_revenue NUMERIC(14,2);
  v_total_expenses NUMERIC(14,2);
  v_total_payroll NUMERIC(14,2);
  v_revenue_details JSONB;
  v_expense_details JSONB;
  v_payroll_details JSONB;
BEGIN
  -- الإيرادات من الفواتير المدفوعة
  SELECT
    COALESCE(SUM(total_amount), 0),
    COALESCE(
      jsonb_agg(jsonb_build_object(
        'id', id,
        'invoice_number', invoice_number,
        'amount', total_amount,
        'date', created_at::DATE,
        'status', status
      ) ORDER BY created_at DESC),
      '[]'::JSONB
    )
  INTO v_total_revenue, v_revenue_details
  FROM invoices
  WHERE status IN ('paid', 'confirmed', 'partially_paid')
    AND created_at::DATE BETWEEN p_date_from AND p_date_to;

  -- المصروفات (باستثناء الرواتب — نعرضها منفصلة)
  SELECT
    COALESCE(SUM(e.amount), 0),
    COALESCE(
      jsonb_agg(jsonb_build_object(
        'id', e.id,
        'description', e.description,
        'amount', e.amount,
        'category', COALESCE(ec.name_ar, 'بدون تصنيف'),
        'date', e.created_at::DATE,
        'status', e.status
      ) ORDER BY e.created_at DESC),
      '[]'::JSONB
    )
  INTO v_total_expenses, v_expense_details
  FROM expenses e
  LEFT JOIN expense_categories ec ON ec.id = e.category_id
  WHERE e.status = 'approved'
    AND e.created_at::DATE BETWEEN p_date_from AND p_date_to
    AND ec.name IS DISTINCT FROM 'salaries';

  -- الرواتب المعتمدة في الفترة
  SELECT
    COALESCE(SUM(pp.net_total), 0),
    COALESCE(
      jsonb_agg(jsonb_build_object(
        'id', pp.id,
        'month', pp.month,
        'year', pp.year,
        'net_total', pp.net_total,
        'total_salaries', pp.total_salaries,
        'total_incentives', pp.total_incentives,
        'total_deductions', pp.total_deductions,
        'total_absence_deductions', pp.total_absence_deductions,
        'approved_at', pp.approved_at
      ) ORDER BY pp.year DESC, pp.month DESC),
      '[]'::JSONB
    )
  INTO v_total_payroll, v_payroll_details
  FROM payroll_periods pp
  WHERE pp.status = 'approved'
    AND pp.approved_at::DATE BETWEEN p_date_from AND p_date_to;

  RETURN QUERY SELECT
    v_total_revenue,
    v_total_expenses,
    v_total_payroll,
    v_total_revenue - v_total_expenses - v_total_payroll,
    v_revenue_details,
    v_expense_details,
    v_payroll_details;
END;
$$;


-- =====================================================================
-- PART 4: RLS POLICIES — سياسات أمان الصفوف
-- =====================================================================

-- تمكين RLS
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE advance_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_adjustments ENABLE ROW LEVEL SECURITY;

-- attendance_records
DROP POLICY IF EXISTS "authenticated can read attendance" ON attendance_records;
CREATE POLICY "authenticated can read attendance" ON attendance_records
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated can insert attendance" ON attendance_records;
CREATE POLICY "authenticated can insert attendance" ON attendance_records
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated can update attendance" ON attendance_records;
CREATE POLICY "authenticated can update attendance" ON attendance_records
  FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated can delete attendance" ON attendance_records;
CREATE POLICY "authenticated can delete attendance" ON attendance_records
  FOR DELETE TO authenticated USING (true);

-- company_locations
DROP POLICY IF EXISTS "authenticated can read company_locations" ON company_locations;
CREATE POLICY "authenticated can read company_locations" ON company_locations
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated can manage company_locations" ON company_locations;
CREATE POLICY "authenticated can manage company_locations" ON company_locations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- payroll_periods
DROP POLICY IF EXISTS "authenticated can read payroll_periods" ON payroll_periods;
CREATE POLICY "authenticated can read payroll_periods" ON payroll_periods
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated can insert payroll_periods" ON payroll_periods;
CREATE POLICY "authenticated can insert payroll_periods" ON payroll_periods
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated can update payroll_periods" ON payroll_periods;
CREATE POLICY "authenticated can update payroll_periods" ON payroll_periods
  FOR UPDATE TO authenticated USING (true);

-- payroll_items
DROP POLICY IF EXISTS "authenticated can read payroll_items" ON payroll_items;
CREATE POLICY "authenticated can read payroll_items" ON payroll_items
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated can insert payroll_items" ON payroll_items;
CREATE POLICY "authenticated can insert payroll_items" ON payroll_items
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated can update payroll_items" ON payroll_items;
CREATE POLICY "authenticated can update payroll_items" ON payroll_items
  FOR UPDATE TO authenticated USING (true);

-- salary_advances
DROP POLICY IF EXISTS "authenticated can read salary_advances" ON salary_advances;
CREATE POLICY "authenticated can read salary_advances" ON salary_advances
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated can insert salary_advances" ON salary_advances;
CREATE POLICY "authenticated can insert salary_advances" ON salary_advances
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated can update salary_advances" ON salary_advances;
CREATE POLICY "authenticated can update salary_advances" ON salary_advances
  FOR UPDATE TO authenticated USING (true);

-- advance_installments
DROP POLICY IF EXISTS "authenticated can read advance_installments" ON advance_installments;
CREATE POLICY "authenticated can read advance_installments" ON advance_installments
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated can insert advance_installments" ON advance_installments;
CREATE POLICY "authenticated can insert advance_installments" ON advance_installments
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated can update advance_installments" ON advance_installments;
CREATE POLICY "authenticated can update advance_installments" ON advance_installments
  FOR UPDATE TO authenticated USING (true);

-- hr_adjustments
DROP POLICY IF EXISTS "authenticated can read hr_adjustments" ON hr_adjustments;
CREATE POLICY "authenticated can read hr_adjustments" ON hr_adjustments
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated can insert hr_adjustments" ON hr_adjustments;
CREATE POLICY "authenticated can insert hr_adjustments" ON hr_adjustments
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated can update hr_adjustments" ON hr_adjustments;
CREATE POLICY "authenticated can update hr_adjustments" ON hr_adjustments
  FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated can delete hr_adjustments" ON hr_adjustments;
CREATE POLICY "authenticated can delete hr_adjustments" ON hr_adjustments
  FOR DELETE TO authenticated USING (true);


-- =====================================================================
-- PART 4.4: PAYROLL DISBURSEMENT TRACKING — تتبع صرف الرواتب
-- =====================================================================

-- 1. جدول دفعات الصرف
CREATE TABLE IF NOT EXISTS payroll_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
  notes TEXT,
  disbursed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_disbursements_period ON payroll_disbursements(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_disbursements_vault ON payroll_disbursements(vault_id);

-- 2. إضافة عمود إجمالى المصروف + توسيع حالات المسير
ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS total_disbursed NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE payroll_periods DROP CONSTRAINT IF EXISTS payroll_periods_status_check;
DO $$ BEGIN
  -- حذف أى constraint على عمود status
  PERFORM 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
   WHERE c.conrelid = 'payroll_periods'::regclass
     AND c.contype = 'c'
     AND a.attname = 'status';
  IF FOUND THEN
    EXECUTE (
      SELECT 'ALTER TABLE payroll_periods DROP CONSTRAINT ' || c.conname
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'payroll_periods'::regclass
        AND c.contype = 'c'
        AND a.attname = 'status'
      LIMIT 1
    );
  END IF;
END $$;

ALTER TABLE payroll_periods ADD CONSTRAINT payroll_periods_status_check
  CHECK (status IN ('draft', 'calculated', 'approved', 'partially_paid', 'paid'));

-- 3. RLS لجدول الدفعات
ALTER TABLE payroll_disbursements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated can read payroll_disbursements" ON payroll_disbursements;
CREATE POLICY "authenticated can read payroll_disbursements" ON payroll_disbursements
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated can insert payroll_disbursements" ON payroll_disbursements;
CREATE POLICY "authenticated can insert payroll_disbursements" ON payroll_disbursements
  FOR INSERT TO authenticated WITH CHECK (true);


-- =====================================================================
-- PART 4.5: ADVANCES + VAULT INTEGRATION — ربط السلف بالنظام المالى
-- =====================================================================
-- يُضيف حالة "pending" (معلقة) للسلف + ربط بالخزنة عند الاعتماد

-- 1. إضافة حالة pending + عمود vault_id
ALTER TABLE salary_advances DROP CONSTRAINT IF EXISTS salary_advances_status_check;
ALTER TABLE salary_advances ADD CONSTRAINT salary_advances_status_check
  CHECK (status IN ('pending', 'active', 'completed', 'cancelled'));
ALTER TABLE salary_advances ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE salary_advances ADD COLUMN IF NOT EXISTS vault_id UUID REFERENCES vaults(id) ON DELETE SET NULL;

-- 2. دالة اعتماد السلفة مع خصم من الخزنة (ذرية)
CREATE OR REPLACE FUNCTION approve_advance_from_vault(
  p_advance_id UUID,
  p_vault_id UUID,
  p_approved_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_advance RECORD;
  v_vault RECORD;
  v_new_balance NUMERIC(12,2);
BEGIN
  -- 1. جلب السلفة والتحقق من حالتها
  SELECT * INTO v_advance FROM salary_advances WHERE id = p_advance_id FOR UPDATE;
  
  IF v_advance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'السلفة غير موجودة');
  END IF;
  
  IF v_advance.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'السلفة ليست فى حالة معلقة — الحالة الحالية: ' || v_advance.status);
  END IF;
  
  -- 2. جلب الخزنة والتحقق من الرصيد
  SELECT * INTO v_vault FROM vaults WHERE id = p_vault_id FOR UPDATE;
  
  IF v_vault IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الخزنة غير موجودة');
  END IF;
  
  IF NOT v_vault.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'الخزنة غير نشطة');
  END IF;
  
  IF v_vault.balance < v_advance.total_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'رصيد الخزنة غير كافٍ',
      'code', 'INSUFFICIENT_BALANCE',
      'vault_balance', v_vault.balance,
      'required_amount', v_advance.total_amount
    );
  END IF;
  
  -- 3. خصم المبلغ من الخزنة
  v_new_balance := v_vault.balance - v_advance.total_amount;
  
  UPDATE vaults
  SET balance = v_new_balance,
      updated_at = NOW()
  WHERE id = p_vault_id;
  
  -- 4. تسجيل حركة الخزنة
  INSERT INTO vault_transactions (
    vault_id, type, amount, notes,
    reference_type, reference_id,
    balance_after,
    performed_by
  ) VALUES (
    p_vault_id,
    'withdrawal',
    v_advance.total_amount,
    'صرف سلفة — ' || COALESCE(v_advance.reason, 'بدون سبب'),
    'salary_advance',
    p_advance_id,
    v_new_balance,
    p_approved_by
  );
  
  -- 5. تحديث حالة السلفة
  UPDATE salary_advances
  SET status = 'active',
      vault_id = p_vault_id,
      approved_by = p_approved_by,
      updated_at = NOW()
  WHERE id = p_advance_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم اعتماد السلفة وخصمها من الخزنة بنجاح',
    'new_vault_balance', v_new_balance,
    'deducted_amount', v_advance.total_amount,
    'vault_id', p_vault_id
  );
END;
$$;


-- =====================================================================
-- PART 6: ROLLBACK SCRIPT (for reference)
-- =====================================================================
-- To rollback this migration, run:
/*
  DROP TRIGGER IF EXISTS trigger_auto_start_route ON orders;
  DROP TRIGGER IF EXISTS trigger_auto_complete_route ON orders;
  DROP TRIGGER IF EXISTS trigger_auto_check_out ON routes;

  DROP FUNCTION IF EXISTS auto_start_route_on_first_order();
  DROP FUNCTION IF EXISTS auto_complete_route_on_last_order();
  DROP FUNCTION IF EXISTS auto_check_out_on_route_complete();
  DROP FUNCTION IF EXISTS calculate_payroll(INT, INT);
  DROP FUNCTION IF EXISTS approve_payroll(UUID, UUID);
  DROP FUNCTION IF EXISTS disburse_payroll(UUID, UUID, NUMERIC, UUID);
  DROP FUNCTION IF EXISTS get_profit_loss_report(DATE, DATE);
  DROP FUNCTION IF EXISTS approve_advance_from_vault(UUID, UUID, UUID);
  DROP FUNCTION IF EXISTS calculate_worker_bonuses(date, numeric, numeric);

  DROP TABLE IF EXISTS payroll_disbursements;
  DROP TABLE IF EXISTS advance_installments;
  DROP TABLE IF EXISTS salary_advances;
  DROP TABLE IF EXISTS hr_adjustments;
  DROP TABLE IF EXISTS payroll_items;
  DROP TABLE IF EXISTS payroll_periods;
  DROP TABLE IF EXISTS company_locations;
  DROP TABLE IF EXISTS attendance_records;

  ALTER TABLE workers DROP COLUMN IF EXISTS paid_leave_days;
*/
