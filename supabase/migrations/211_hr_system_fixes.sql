-- =====================================================================
-- Migration 211: HR System Fixes — إصلاحات نظام الموارد البشرية
-- =====================================================================
-- Fix #1: إضافة work_start_time لمواقع الشركة
-- Fix #2: إصلاح v_today فى calculate_payroll
-- Fix #3: حماية بنود الصرف عند إعادة الحساب
-- Fix #5: إعادة تعيين is_processed عند إعادة الحساب
-- =====================================================================


-- =====================================================================
-- PART 1: إضافة وقت بداية الدوام لمواقع الشركة
-- =====================================================================

ALTER TABLE company_locations
  ADD COLUMN IF NOT EXISTS work_start_time TIME NOT NULL DEFAULT '09:00:00';

COMMENT ON COLUMN company_locations.work_start_time
  IS 'وقت بداية الدوام — يُستخدم لحساب التأخير تلقائياً عند تسجيل الحضور';


-- =====================================================================
-- PART 2: إعادة كتابة calculate_payroll مع الإصلاحات الثلاثة
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
  v_month_start DATE;
  v_month_end DATE;
  v_today DATE;
  v_total_month_days INT;
  v_worker RECORD;

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
  v_unpaid_leave NUMERIC(5,1);
  v_unrecorded_days NUMERIC(5,1);

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

  -- ⭐ Fix #3: حماية بنود الصرف — التحقق من عدم وجود بنود مصروفة
  IF EXISTS (
    SELECT 1 FROM payroll_items
    WHERE payroll_period_id = v_period_id
      AND payment_status = 'paid'
  ) THEN
    RAISE EXCEPTION 'لا يمكن إعادة الحساب — يوجد بنود مصروفة بالفعل لهذا المسير. يجب إلغاء الصرف أولاً.';
  END IF;

  -- ⭐ Fix #5: إعادة تعيين التسويات المعالجة لهذا الشهر
  --    (عند إعادة الحساب يجب إدراج التسويات مرة أخرى)
  UPDATE hr_adjustments
  SET is_processed = false,
      updated_at = NOW()
  WHERE date BETWEEN v_month_start AND v_month_end
    AND is_processed = true;

  -- ⭐ Fix #5: إعادة تعيين حالة أقساط السلف لهذا الشهر
  UPDATE advance_installments
  SET status = 'pending',
      updated_at = NOW()
  WHERE month = p_month
    AND year = p_year
    AND status = 'deducted';

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

    -- ⭐ Fix #2: إصلاح v_today — فقط يقيّد الشهر الحالى
    --    الشهور السابقة: v_today > v_month_end → يعود لـ v_month_end (سليم)
    --    الشهر الحالى: v_today < v_month_end → يقيّد بـ v_today (سليم)
    --    الشهور المستقبلية: v_today < v_month_start → كان يسبب تجاهل العامل (الخلل)
    --    الإصلاح: نستخدم v_today فقط إذا كان ضمن نطاق الشهر
    v_worker_end := LEAST(
      v_month_end,
      COALESCE(v_worker.termination_date, v_month_end)::DATE,
      CASE WHEN v_today >= v_month_start AND v_today < v_month_end
           THEN v_today
           ELSE v_month_end
      END
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
    v_total_work_days := GREATEST(1,
      v_total_month_days
      - v_worker.paid_leave_days
      - (SELECT COUNT(*) FROM public_holidays
         WHERE date BETWEEN v_month_start AND v_month_end AND is_active = true)
    );

    v_daily_rate := ROUND(v_worker.salary::NUMERIC / v_total_work_days, 2);
    v_effective_work_days := ROUND(v_total_work_days * v_ratio, 1);
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
    -- 3.5 حساب الغياب ورصيد الإجازات (مُصلَح)
    -- ============================================
    -- الخطوة 1: الإجازات المسجلة تستهلك الرصيد فقط
    v_leave_used := LEAST(v_leave_days::NUMERIC, v_leave_balance);

    -- الخطوة 2: إجازات تتجاوز الرصيد = بدون أجر
    v_unpaid_leave := GREATEST(0, v_leave_days::NUMERIC - v_leave_balance);

    -- الخطوة 3: أيام بدون أي سجل حضور = تُعامل كغياب
    v_unrecorded_days := GREATEST(0,
      v_available_days::INT - v_work_days - v_leave_days - v_absent_days
      - v_holiday_days
      - GREATEST(0, v_public_holidays_count - v_holiday_days)
    );

    -- الخطوة 4: إجمالي الغياب بدون أجر = غياب مسجل + أيام بدون سجل + إجازات فوق الرصيد
    v_unpaid_absent_days := v_absent_days + v_unrecorded_days + v_unpaid_leave;

    -- حساب إجمالي أيام عدم العمل (للتوافق مع الأعمدة القديمة)
    v_total_days_off := GREATEST(0,
      v_available_days::INT - v_work_days - v_holiday_days
      - GREATEST(0, v_public_holidays_count - v_holiday_days)
    );

    v_absence_deduction := ROUND(v_daily_rate * v_unpaid_absent_days, 2);

    -- ============================================
    -- 3.6 حساب جزاءات التأخير
    -- ============================================
    v_late_penalty_days := 0;
    v_late_penalty_amount := 0;
    v_grace_used := 0;
    v_minor_late_count := 0;
    v_grace_limit := 0;

    SELECT COALESCE(pr.grace_count, 0) INTO v_grace_limit
    FROM penalty_rules pr
    WHERE pr.type = 'late' AND pr.name = 'grace_period' AND pr.is_active = true
    LIMIT 1;

    FOR v_late_rec IN
      SELECT ar.late_minutes
      FROM attendance_records ar
      WHERE ar.worker_id = v_worker.id
        AND ar.date BETWEEN v_worker_start AND v_worker_end
        AND ar.status = 'late'
        AND ar.late_minutes > 0
      ORDER BY ar.date
    LOOP
      SELECT pr.* INTO v_penalty_rule
      FROM penalty_rules pr
      WHERE pr.type = 'late'
        AND pr.is_active = true
        AND v_late_rec.late_minutes >= pr.min_minutes
        AND (pr.max_minutes IS NULL OR v_late_rec.late_minutes < pr.max_minutes)
      ORDER BY pr.min_minutes DESC
      LIMIT 1;

      IF v_penalty_rule IS NOT NULL THEN
        IF v_penalty_rule.name = 'grace_period' THEN
          v_grace_used := v_grace_used + 1;
          IF v_grace_used <= v_grace_limit THEN
            CONTINUE;
          END IF;
          v_late_penalty_days := v_late_penalty_days + 0.25;

        ELSIF v_penalty_rule.name = 'minor_late' THEN
          v_minor_late_count := v_minor_late_count + 1;
          IF v_minor_late_count >= 3 THEN
            v_late_penalty_days := v_late_penalty_days + 0.25;
            v_minor_late_count := 0;
          END IF;

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
