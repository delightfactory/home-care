-- =====================================================================
-- Migration 210: Payroll Calculation V2
-- نظام حساب الرواتب الجديد — طريقة أيام العمل الصافية
-- =====================================================================
--
-- 📋 التغييرات:
--   1. إضافة termination_date لجدول workers
--   2. إنشاء جدول العطل الرسمية (public_holidays)
--   3. إنشاء جدول قواعد الجزاءات (penalty_rules) + بيانات افتراضية
--   4. إضافة late_minutes لسجلات الحضور
--   5. إضافة أعمدة جديدة لـ payroll_items
--   6. إعادة كتابة calculate_payroll بالنظام الجديد
--
-- 📋 قواعد الحساب الجديدة:
--   - أيام العمل المطلوبة = أيام_الشهر − إجازات_مدفوعة − عطل_رسمية
--   - اليومية = الراتب ÷ أيام_العمل_المطلوبة
--   - Pro-Rata: لعمال منتصف الشهر (hire_date / termination_date)
--   - رصيد الإجازات: استخدمها أو افقدها (لا ترحيل)
--   - جزاءات التأخير: متدرجة حسب penalty_rules
-- =====================================================================


-- =====================================================================
-- PART 1: SCHEMA CHANGES
-- =====================================================================

-- 1.1 إضافة تاريخ إنهاء الخدمة لجدول العمال
ALTER TABLE workers ADD COLUMN IF NOT EXISTS termination_date DATE;

-- 1.2 إضافة دقائق التأخير لسجل الحضور
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS late_minutes INT NOT NULL DEFAULT 0;

-- 1.3 أعمدة جديدة فى payroll_items
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS effective_days NUMERIC(5,1) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS required_work_days NUMERIC(5,1) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS public_holiday_days INT NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS leave_balance NUMERIC(5,1) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS leave_used NUMERIC(5,1) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS late_penalty_days NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS late_penalty_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS worker_start_date DATE;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS worker_end_date DATE;


-- =====================================================================
-- PART 2: PUBLIC HOLIDAYS TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  year INT GENERATED ALWAYS AS (EXTRACT(YEAR FROM date)::INT) STORED,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(date)
);

CREATE INDEX IF NOT EXISTS idx_public_holidays_date ON public_holidays(date);
CREATE INDEX IF NOT EXISTS idx_public_holidays_year ON public_holidays(year);


-- =====================================================================
-- PART 3: PENALTY RULES TABLE + DEFAULT DATA
-- =====================================================================

CREATE TABLE IF NOT EXISTS penalty_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('late', 'absent', 'early_leave')),
  min_minutes INT NOT NULL DEFAULT 0,
  max_minutes INT,   -- NULL = no upper limit
  deduction_days NUMERIC(5,2) NOT NULL DEFAULT 0,  -- كسور يوم (0.25 = ربع يوم)
  grace_count INT NOT NULL DEFAULT 0,   -- عدد المرات المسموحة قبل التطبيق (0 = فورى)
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- بيانات افتراضية — جدول الجزاءات المتدرج
INSERT INTO penalty_rules (name, name_ar, type, min_minutes, max_minutes, deduction_days, grace_count, sort_order) VALUES
  ('grace_period',   'فترة السماح',     'late',   0,   15,  0,     3, 1),
  ('minor_late',     'تأخير بسيط',      'late',  15,   30,  0,     0, 2),  -- إنذار فقط (يتحول لخصم بعد 3 مرات عبر grace)
  ('moderate_late',  'تأخير متوسط',     'late',  30,   60,  0.25,  0, 3),
  ('major_late',     'تأخير كبير',      'late',  60,  120,  0.50,  0, 4),
  ('partial_absent', 'غياب جزئى',       'late', 120, NULL,  1.00,  0, 5)
ON CONFLICT DO NOTHING;


-- =====================================================================
-- PART 4: REWRITE calculate_payroll — النظام الجديد
-- =====================================================================

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
  v_month_start DATE;
  v_month_end DATE;
  v_today DATE;
  v_total_month_days INT;

  -- Per-worker
  v_worker_start DATE;
  v_worker_end DATE;
  v_available_days NUMERIC(5,1);
  v_ratio NUMERIC(7,4);
  v_public_holidays_count INT;
  v_total_work_days NUMERIC(5,1);
  v_daily_rate NUMERIC(12,2);
  v_effective_work_days NUMERIC(5,1);
  v_leave_balance NUMERIC(5,1);

  -- Attendance
  v_work_days INT;
  v_absent_days INT;
  v_leave_days INT;
  v_late_days INT;
  v_holiday_days INT;

  -- Leave & absence
  v_total_days_off INT;
  v_leave_used NUMERIC(5,1);
  v_unpaid_absent_days NUMERIC(5,1);

  -- Late penalties
  v_late_rec RECORD;
  v_late_penalty_days NUMERIC(5,2);
  v_late_penalty_amount NUMERIC(12,2);
  v_grace_used INT;
  v_grace_limit INT;
  v_minor_late_count INT;
  v_penalty_rule RECORD;

  -- Financial
  v_absence_deduction NUMERIC(12,2);
  v_calculated_bonus NUMERIC(12,2);
  v_manual_incentives NUMERIC(12,2);
  v_manual_deductions NUMERIC(12,2);
  v_manual_penalties NUMERIC(12,2);
  v_manual_bonuses NUMERIC(12,2);
  v_advance_deduction NUMERIC(12,2);
  v_base_pay NUMERIC(12,2);
  v_net_salary NUMERIC(12,2);

  -- Totals
  v_total_salaries NUMERIC(14,2) := 0;
  v_total_incentives NUMERIC(14,2) := 0;
  v_total_deductions NUMERIC(14,2) := 0;
  v_total_penalties NUMERIC(14,2) := 0;
  v_total_bonuses NUMERIC(14,2) := 0;
  v_total_advances NUMERIC(14,2) := 0;
  v_total_absence NUMERIC(14,2) := 0;
  v_net_total NUMERIC(14,2) := 0;
BEGIN
  -- ============================================
  -- 0. التحقق من عدم وجود مسير معتمد/مصروف
  -- ============================================
  SELECT status INTO v_period_status
  FROM payroll_periods
  WHERE month = p_month AND year = p_year;

  IF v_period_status IN ('approved', 'partially_paid', 'paid') THEN
    RAISE EXCEPTION 'لا يمكن إعادة حساب مسير معتمد أو مصروف. شهر %/% حالته: %',
      p_month, p_year, v_period_status;
  END IF;

  -- ============================================
  -- 1. حساب نطاق الشهر
  -- ============================================
  v_month_start := MAKE_DATE(p_year, p_month, 1);
  v_month_end := (v_month_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  v_today := CURRENT_DATE;
  v_total_month_days := EXTRACT(DAY FROM v_month_end)::INT;

  -- ============================================
  -- 2. إنشاء أو تحديث المسير
  -- ============================================
  INSERT INTO payroll_periods (month, year, status)
  VALUES (p_month, p_year, 'calculated')
  ON CONFLICT (month, year) DO UPDATE
    SET status = 'calculated',
        updated_at = NOW()
  RETURNING id INTO v_period_id;

  -- حذف البنود القديمة (إعادة حساب)
  DELETE FROM payroll_items WHERE payroll_period_id = v_period_id;

  -- ============================================
  -- 3. حساب لكل عامل نشط (أو أنهى خدمته خلال الشهر)
  -- ============================================
  FOR v_worker IN
    SELECT
      w.id,
      w.salary,
      COALESCE(w.paid_leave_days, 4) AS paid_leave_days,
      w.hire_date,
      w.termination_date,
      w.status AS worker_status
    FROM workers w
    WHERE w.salary IS NOT NULL
      AND w.salary > 0
      AND (
        -- عامل نشط
        w.status = 'active'
        -- أو عامل أنهى خدمته خلال هذا الشهر (لحساب راتبه الأخير)
        OR (w.status = 'inactive' AND w.termination_date IS NOT NULL
            AND w.termination_date >= v_month_start
            AND w.termination_date <= v_month_end)
      )
  LOOP
    -- ============================================
    -- 3.1 تحديد فترة عمل العامل فى هذا الشهر
    -- ============================================
    v_worker_start := GREATEST(v_month_start, COALESCE(v_worker.hire_date, v_month_start)::DATE);
    v_worker_end := LEAST(
      v_month_end,
      COALESCE(v_worker.termination_date, v_month_end)::DATE,
      v_today
    );

    -- التأكد من أن العامل له أيام فعلية فى هذا الشهر
    IF v_worker_end < v_worker_start THEN
      CONTINUE;
    END IF;

    v_available_days := (v_worker_end - v_worker_start)::NUMERIC + 1;
    v_ratio := v_available_days / v_total_month_days::NUMERIC;

    -- ============================================
    -- 3.2 حساب العطل الرسمية فى فترة عمل هذا العامل
    -- ============================================
    SELECT COUNT(*)
    INTO v_public_holidays_count
    FROM public_holidays
    WHERE date BETWEEN v_worker_start AND v_worker_end
      AND is_active = true;

    -- ============================================
    -- 3.3 حساب أيام العمل المطلوبة واليومية
    -- ============================================
    -- أيام العمل المطلوبة للشهر الكامل (بدون نسبية)
    -- = أيام_الشهر − إجازات_مدفوعة − عطل_رسمية (كامل الشهر)
    v_total_work_days := GREATEST(1,
      v_total_month_days
      - v_worker.paid_leave_days
      - (SELECT COUNT(*) FROM public_holidays
         WHERE date BETWEEN v_month_start AND v_month_end AND is_active = true)
    );

    -- اليومية = الراتب ÷ أيام العمل المطلوبة (ثابتة لكل الشهر)
    v_daily_rate := ROUND(v_worker.salary::NUMERIC / v_total_work_days, 2);

    -- أيام العمل المطلوبة لهذا العامل (نسبية)
    v_effective_work_days := ROUND(v_total_work_days * v_ratio, 1);

    -- رصيد الإجازات المدفوعة (نسبى)
    v_leave_balance := ROUND(v_worker.paid_leave_days::NUMERIC * v_ratio, 1);

    -- ============================================
    -- 3.4 بيانات الحضور
    -- ============================================
    SELECT
      COALESCE(COUNT(*) FILTER (WHERE status IN ('present', 'late')), 0),
      COALESCE(COUNT(*) FILTER (WHERE status = 'absent'), 0),
      COALESCE(COUNT(*) FILTER (WHERE status = 'leave'), 0),
      COALESCE(COUNT(*) FILTER (WHERE status = 'late'), 0),
      COALESCE(COUNT(*) FILTER (WHERE status = 'holiday'), 0)
    INTO v_work_days, v_absent_days, v_leave_days, v_late_days, v_holiday_days
    FROM attendance_records
    WHERE worker_id = v_worker.id
      AND date BETWEEN v_worker_start AND v_worker_end;

    -- ============================================
    -- 3.5 حساب الغياب ورصيد الإجازات
    -- ============================================
    -- أيام عدم الحضور = الأيام المتاحة − أيام الحضور − العطلات المسجلة فى attendance
    -- ملاحظة: لا نطرح v_public_holidays_count هنا لأن العطل الرسمية
    -- إما مسجلة فى attendance كـ 'holiday' (وبالتالى محسوبة فى v_holiday_days)
    -- أو غير مسجلة (وبالتالى يجب طرحها)
    -- لذلك نطرح فقط العطل الرسمية التى ليس لها سجل attendance
    v_total_days_off := GREATEST(0,
      v_available_days::INT - v_work_days - v_holiday_days
      - GREATEST(0, v_public_holidays_count - v_holiday_days)
    );

    -- الإجازات المستخدمة = الأقل بين (أيام عدم الحضور) و (الرصيد)
    v_leave_used := LEAST(v_total_days_off::NUMERIC, v_leave_balance);

    -- الغياب بدون رصيد = ما يزيد عن الإجازات
    v_unpaid_absent_days := GREATEST(0, v_total_days_off::NUMERIC - v_leave_balance);

    -- خصم الغياب
    v_absence_deduction := ROUND(v_daily_rate * v_unpaid_absent_days, 2);

    -- ============================================
    -- 3.6 حساب جزاءات التأخير
    -- ============================================
    v_late_penalty_days := 0;
    v_late_penalty_amount := 0;
    v_grace_used := 0;
    v_minor_late_count := 0;
    v_grace_limit := 0;

    -- عدد مرات السماح المحددة فى القاعدة
    SELECT COALESCE(pr.grace_count, 0) INTO v_grace_limit
    FROM penalty_rules pr
    WHERE pr.type = 'late' AND pr.name = 'grace_period' AND pr.is_active = true
    LIMIT 1;

    -- لكل سجل تأخير فى الشهر
    FOR v_late_rec IN
      SELECT ar.late_minutes
      FROM attendance_records ar
      WHERE ar.worker_id = v_worker.id
        AND ar.date BETWEEN v_worker_start AND v_worker_end
        AND ar.status = 'late'
        AND ar.late_minutes > 0
      ORDER BY ar.date
    LOOP
      -- البحث عن قاعدة الجزاء المناسبة
      SELECT pr.* INTO v_penalty_rule
      FROM penalty_rules pr
      WHERE pr.type = 'late'
        AND pr.is_active = true
        AND v_late_rec.late_minutes >= pr.min_minutes
        AND (pr.max_minutes IS NULL OR v_late_rec.late_minutes < pr.max_minutes)
      ORDER BY pr.min_minutes DESC
      LIMIT 1;

      IF v_penalty_rule IS NOT NULL THEN
        -- فترة السماح — أول N مرات بدون جزاء
        IF v_penalty_rule.name = 'grace_period' THEN
          v_grace_used := v_grace_used + 1;
          IF v_grace_used <= v_grace_limit THEN
            CONTINUE; -- بدون جزاء
          END IF;
          -- تجاوز السماح → يُعامل كتأخير بسيط (ربع يوم)
          v_late_penalty_days := v_late_penalty_days + 0.25;

        -- تأخير بسيط — إنذار، كل 3 إنذارات = ربع يوم
        ELSIF v_penalty_rule.name = 'minor_late' THEN
          v_minor_late_count := v_minor_late_count + 1;
          IF v_minor_late_count >= 3 THEN
            v_late_penalty_days := v_late_penalty_days + 0.25;
            v_minor_late_count := 0; -- إعادة العداد
          END IF;

        -- باقى المستويات — خصم مباشر
        ELSE
          v_late_penalty_days := v_late_penalty_days + COALESCE(v_penalty_rule.deduction_days, 0);
        END IF;
      END IF;
    END LOOP;

    v_late_penalty_amount := ROUND(v_daily_rate * v_late_penalty_days, 2);

    -- ============================================
    -- 3.7 الحوافز من calculate_worker_bonuses
    -- ============================================
    v_calculated_bonus := 0;
    BEGIN
      SELECT COALESCE(base_bonus, 0) INTO v_calculated_bonus
      FROM calculate_worker_bonuses(v_month_start)
      WHERE worker_id = v_worker.id;
    EXCEPTION WHEN OTHERS THEN
      v_calculated_bonus := 0;
    END;
    v_calculated_bonus := COALESCE(v_calculated_bonus, 0);

    -- ============================================
    -- 3.8 التسويات اليدوية
    -- ============================================
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE type = 'bonus'), 0),
      COALESCE(SUM(amount) FILTER (WHERE type = 'deduction'), 0),
      COALESCE(SUM(amount) FILTER (WHERE type = 'penalty'), 0)
    INTO v_manual_bonuses, v_manual_deductions, v_manual_penalties
    FROM hr_adjustments
    WHERE worker_id = v_worker.id
      AND date BETWEEN v_month_start AND v_month_end
      AND is_processed = false;

    v_manual_incentives := 0;

    -- ============================================
    -- 3.9 أقساط السلف المستحقة
    -- ============================================
    SELECT COALESCE(SUM(ai.amount), 0)
    INTO v_advance_deduction
    FROM advance_installments ai
    JOIN salary_advances sa ON sa.id = ai.advance_id
    WHERE sa.worker_id = v_worker.id
      AND sa.status = 'active'
      AND ai.month = p_month
      AND ai.year = p_year
      AND ai.status = 'pending';

    -- ============================================
    -- 3.10 حساب الصافى
    -- ============================================
    -- المستحق الأساسى = اليومية × أيام العمل المطلوبة (النسبية)
    v_base_pay := ROUND(v_daily_rate * v_effective_work_days, 2);

    v_net_salary := v_base_pay
                  + COALESCE(v_calculated_bonus, 0)
                  + COALESCE(v_manual_bonuses, 0)
                  - v_absence_deduction
                  - v_late_penalty_amount
                  - COALESCE(v_manual_deductions, 0)
                  - COALESCE(v_manual_penalties, 0)
                  - COALESCE(v_advance_deduction, 0);

    -- ============================================
    -- 3.11 إدراج بند الراتب
    -- ============================================
    INSERT INTO payroll_items (
      payroll_period_id, worker_id,
      base_salary, total_month_days, paid_leave_allowance,
      work_days, absent_days, leave_days, late_days, holiday_days,
      unpaid_absent_days, daily_rate, absence_deduction,
      calculated_bonus,
      manual_incentives, manual_deductions, manual_penalties, manual_bonuses,
      advance_deduction, net_salary,
      -- أعمدة V2 الجديدة
      effective_days, required_work_days, public_holiday_days,
      leave_balance, leave_used,
      late_penalty_days, late_penalty_amount,
      worker_start_date, worker_end_date
    ) VALUES (
      v_period_id, v_worker.id,
      COALESCE(v_worker.salary, 0), v_total_month_days, v_worker.paid_leave_days,
      v_work_days, v_absent_days, v_leave_days, v_late_days, v_holiday_days,
      v_unpaid_absent_days::INT, v_daily_rate, v_absence_deduction,
      v_calculated_bonus,
      COALESCE(v_manual_incentives, 0), COALESCE(v_manual_deductions, 0),
      COALESCE(v_manual_penalties, 0), COALESCE(v_manual_bonuses, 0),
      COALESCE(v_advance_deduction, 0), v_net_salary,
      -- V2
      v_effective_work_days, v_total_work_days, v_public_holidays_count,
      v_leave_balance, v_leave_used,
      v_late_penalty_days, v_late_penalty_amount,
      v_worker_start, v_worker_end
    );

    -- ============================================
    -- 3.12 تجميع الإجماليات
    -- ============================================
    v_total_salaries := v_total_salaries + v_base_pay;
    v_total_incentives := v_total_incentives + COALESCE(v_calculated_bonus, 0);
    v_total_deductions := v_total_deductions + COALESCE(v_manual_deductions, 0);
    v_total_penalties := v_total_penalties + COALESCE(v_manual_penalties, 0) + v_late_penalty_amount;
    v_total_bonuses := v_total_bonuses + COALESCE(v_manual_bonuses, 0);
    v_total_advances := v_total_advances + COALESCE(v_advance_deduction, 0);
    v_total_absence := v_total_absence + v_absence_deduction;
    v_net_total := v_net_total + v_net_salary;
  END LOOP;

  -- ============================================
  -- 4. تحديث إجماليات المسير
  -- ============================================
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


-- =====================================================================
-- PART 5: ENABLE RLS ON NEW TABLES
-- =====================================================================

ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE penalty_rules ENABLE ROW LEVEL SECURITY;

-- سياسات القراءة — لكل المستخدمين المسجلين
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'public_holidays' AND policyname = 'public_holidays_read') THEN
    CREATE POLICY "public_holidays_read" ON public_holidays
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'penalty_rules' AND policyname = 'penalty_rules_read') THEN
    CREATE POLICY "penalty_rules_read" ON penalty_rules
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- سياسات الكتابة — للأدمن والمدير فقط (عبر RPC get_current_user_role)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'public_holidays' AND policyname = 'public_holidays_write') THEN
    CREATE POLICY "public_holidays_write" ON public_holidays
      FOR ALL TO authenticated
      USING (
        COALESCE(get_current_user_role(), '') IN ('admin', 'manager')
      )
      WITH CHECK (
        COALESCE(get_current_user_role(), '') IN ('admin', 'manager')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'penalty_rules' AND policyname = 'penalty_rules_write') THEN
    CREATE POLICY "penalty_rules_write" ON penalty_rules
      FOR ALL TO authenticated
      USING (
        COALESCE(get_current_user_role(), '') IN ('admin', 'manager')
      )
      WITH CHECK (
        COALESCE(get_current_user_role(), '') IN ('admin', 'manager')
      );
  END IF;
END $$;
