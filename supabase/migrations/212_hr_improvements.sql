-- =====================================================================
-- Migration 212: HR Improvements
-- (1) إلغاء السلفة مع استرداد الخزنة
-- (2) مزامنة العطل الرسمية تلقائياً مع سجلات الحضور
-- =====================================================================


-- =====================================================================
-- PART 1: إلغاء السلفة مع استرداد الخزنة — دالة ذرية
-- =====================================================================

CREATE OR REPLACE FUNCTION cancel_advance_with_refund(
  p_advance_id UUID,
  p_cancelled_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_advance RECORD;
  v_vault RECORD;
  v_refund_amount NUMERIC(12,2);
  v_new_balance NUMERIC(12,2);
  v_worker_name TEXT;
  v_period_id UUID;
BEGIN
  -- 1. جلب السلفة والتحقق من حالتها
  SELECT * INTO v_advance FROM salary_advances WHERE id = p_advance_id FOR UPDATE;

  IF v_advance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'السلفة غير موجودة');
  END IF;

  -- نسمح بالإلغاء فقط للسلف النشطة (المصروفة من خزنة)
  IF v_advance.status <> 'active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'لا يمكن إلغاء سلفة بحالة "' || v_advance.status || '" — فقط السلف النشطة'
    );
  END IF;

  -- 2. المبلغ المُسترد = المتبقى من السلفة
  v_refund_amount := GREATEST(0, v_advance.remaining_amount);

  -- اسم العامل للوصف
  SELECT name INTO v_worker_name FROM workers WHERE id = v_advance.worker_id;

  -- 3. إعادة المبلغ للخزنة (إن وجدت وكان هناك مبلغ)
  IF v_refund_amount > 0 AND v_advance.vault_id IS NOT NULL THEN
    SELECT * INTO v_vault FROM vaults WHERE id = v_advance.vault_id FOR UPDATE;

    IF v_vault IS NOT NULL THEN
      v_new_balance := v_vault.balance + v_refund_amount;

      -- تحديث رصيد الخزنة
      UPDATE vaults
      SET balance = v_new_balance,
          updated_at = NOW()
      WHERE id = v_advance.vault_id;

      -- تسجيل حركة إيداع (استرداد)
      INSERT INTO vault_transactions (
        vault_id, type, amount, notes,
        reference_type, reference_id,
        balance_after,
        performed_by
      ) VALUES (
        v_advance.vault_id,
        'deposit',
        v_refund_amount,
        'استرداد سلفة مُلغاة — ' || COALESCE(v_worker_name, 'عامل') || ' — ' || COALESCE(v_advance.reason, 'بدون سبب'),
        'salary_advance',
        p_advance_id,
        v_new_balance,
        p_cancelled_by
      );
    END IF;
  END IF;

  -- 4. إلغاء الأقساط المعلقة
  UPDATE advance_installments
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE advance_id = p_advance_id
    AND status = 'pending';

  -- 5. تحديث حالة السلفة
  UPDATE salary_advances
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE id = p_advance_id;

  -- 6. إعادة حساب المسير إن وجد (لإزالة خصم القسط)
  SELECT id INTO v_period_id
  FROM payroll_periods
  WHERE month = v_advance.start_month
    AND year = v_advance.start_year
    AND status = 'calculated';

  IF v_period_id IS NOT NULL THEN
    PERFORM calculate_payroll(v_advance.start_month, v_advance.start_year);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم إلغاء السلفة واسترداد ' || v_refund_amount || ' ج.م إلى الخزنة',
    'refund_amount', v_refund_amount,
    'vault_id', v_advance.vault_id,
    'new_vault_balance', v_new_balance
  );
END;
$$;


-- =====================================================================
-- PART 2: مزامنة العطل الرسمية تلقائياً مع الحضور
-- =====================================================================

-- الدالة المُنفّذة عند إضافة/حذف عطلة رسمية
CREATE OR REPLACE FUNCTION sync_holiday_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- إضافة عطلة: إنشاء سجل حضور بحالة holiday لكل عامل نشط
    -- ON CONFLICT DO NOTHING: إذا سجّل الأدمن حضوراً يدوياً سابقاً لا نتعارض معه
    INSERT INTO attendance_records (worker_id, date, status, notes)
    SELECT
      w.id,
      NEW.date,
      'holiday',
      'عطلة رسمية: ' || NEW.name
    FROM workers w
    WHERE w.status = 'active'
      AND w.salary IS NOT NULL
      AND w.salary > 0
    ON CONFLICT (worker_id, date) DO NOTHING;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- حذف عطلة: حذف سجلات holiday فقط (التى أنشأها الـ trigger أو يدوياً بنفس الحالة)
    -- لا نحذف سجلات present/absent/leave — فقط holiday
    DELETE FROM attendance_records
    WHERE date = OLD.date
      AND status = 'holiday'
      AND notes LIKE 'عطلة رسمية:%';

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- إنشاء الـ trigger
DROP TRIGGER IF EXISTS trg_sync_holiday_attendance ON public_holidays;
CREATE TRIGGER trg_sync_holiday_attendance
  AFTER INSERT OR DELETE ON public_holidays
  FOR EACH ROW
  EXECUTE FUNCTION sync_holiday_attendance();


-- =====================================================================
-- PART 3: RLS — سياسات للجداول الجديدة
-- =====================================================================

-- public_holidays — RLS
ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can read public_holidays" ON public_holidays;
CREATE POLICY "authenticated can read public_holidays" ON public_holidays
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated can manage public_holidays" ON public_holidays;
CREATE POLICY "authenticated can manage public_holidays" ON public_holidays
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- penalty_rules — RLS
ALTER TABLE penalty_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can read penalty_rules" ON penalty_rules;
CREATE POLICY "authenticated can read penalty_rules" ON penalty_rules
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated can manage penalty_rules" ON penalty_rules;
CREATE POLICY "authenticated can manage penalty_rules" ON penalty_rules
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
