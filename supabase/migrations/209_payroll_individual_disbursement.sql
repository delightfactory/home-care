-- =====================================================================
-- Migration 209: Payroll Individual Disbursement — صرف رواتب فردى
-- =====================================================================
-- إضافة تتبع فردى لدفعات الرواتب على مستوى كل عامل
-- مع الحفاظ على التوافق الكامل مع:
--   - disburse_payroll() — الصرف المجمّع القديم (لا يتأثر)
--   - get_profit_loss_report() — يقرأ من payroll_disbursements (نسجل فيها)
--   - payroll_periods.total_disbursed — نحدّثها
--   - vault_transactions — نسجل حركة الخزنة
--   - expenses — نسجل المصروف
-- =====================================================================


-- ═══════════════════════════════════════════════════════════
-- PART 1: أعمدة التتبع الفردى على payroll_items
-- ═══════════════════════════════════════════════════════════

-- كم دُفع للعامل فعلاً من صافى راتبه
ALTER TABLE payroll_items
  ADD COLUMN IF NOT EXISTS disbursed_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

-- حالة الدفع: unpaid / paid
ALTER TABLE payroll_items
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid';

-- Constraint على payment_status
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payroll_items_payment_status_check'
  ) THEN
    ALTER TABLE payroll_items
      ADD CONSTRAINT payroll_items_payment_status_check
      CHECK (payment_status IN ('unpaid', 'paid'));
  END IF;
END $$;

-- ربط disbursement بعامل معين (اختيارى — NULL للصرف المجمّع القديم)
ALTER TABLE payroll_disbursements
  ADD COLUMN IF NOT EXISTS worker_ids UUID[] DEFAULT NULL;


-- ═══════════════════════════════════════════════════════════
-- PART 2: دالة صرف رواتب فردى/مجمّع
-- ═══════════════════════════════════════════════════════════
-- تقبل مصفوفة عمال → تحسب إجمالى المتبقى لهم → تخصم من الخزنة
-- تتبع نفس التسلسل المحاسبى بالضبط مثل disburse_payroll():
--   1. تحقق من المسير
--   2. حساب المتبقى الفردى لكل عامل
--   3. تحقق من الخزنة
--   4. خصم من الخزنة
--   5. حركة خزنة
--   6. مصروف
--   7. payroll_disbursement
--   8. تحديث payroll_items (disbursed_amount + payment_status)
--   9. تحديث payroll_periods (total_disbursed + status)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION disburse_worker_salary(
  p_period_id UUID,
  p_worker_ids UUID[],
  p_vault_id UUID,
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
  v_item RECORD;
  v_total_amount NUMERIC(14,2) := 0;
  v_worker_count INT := 0;
  v_new_balance NUMERIC(14,2);
  v_new_period_disbursed NUMERIC(14,2);
  v_expense_id UUID;
  v_category_id UUID;
  v_disbursement_id UUID;
  v_new_status TEXT;
  v_worker_remaining NUMERIC(12,2);
  v_paid_names TEXT[] := '{}';
BEGIN
  -- ═══════════════════
  -- 1. تحقق من المسير
  -- ═══════════════════
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

  -- ═══════════════════════════════════════
  -- 2. حساب المبلغ الإجمالى لكل العمال المحددين
  -- ═══════════════════════════════════════
  IF array_length(p_worker_ids, 1) IS NULL OR array_length(p_worker_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'لم يتم تحديد أى عامل');
  END IF;

  FOR v_item IN
    SELECT pi.id, pi.worker_id, pi.net_salary, pi.disbursed_amount, pi.payment_status,
           w.name AS worker_name
    FROM payroll_items pi
    JOIN workers w ON w.id = pi.worker_id
    WHERE pi.payroll_period_id = p_period_id
      AND pi.worker_id = ANY(p_worker_ids)
    FOR UPDATE OF pi
  LOOP
    -- تجاهل العمال المدفوع لهم بالفعل
    IF v_item.payment_status = 'paid' THEN
      CONTINUE;
    END IF;

    v_worker_remaining := v_item.net_salary - COALESCE(v_item.disbursed_amount, 0);

    IF v_worker_remaining <= 0 THEN
      CONTINUE;
    END IF;

    v_total_amount := v_total_amount + v_worker_remaining;
    v_worker_count := v_worker_count + 1;
    v_paid_names := array_append(v_paid_names, v_item.worker_name);
  END LOOP;

  IF v_worker_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'كل العمال المحددين مدفوع لهم بالفعل');
  END IF;

  IF v_total_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يوجد مبلغ مستحق للصرف');
  END IF;

  -- ═══════════════════════════════════════
  -- 3. تحقق من الخزنة والرصيد
  -- ═══════════════════════════════════════
  SELECT * INTO v_vault FROM vaults WHERE id = p_vault_id FOR UPDATE;

  IF v_vault IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الخزنة غير موجودة');
  END IF;

  IF NOT v_vault.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'الخزنة غير نشطة');
  END IF;

  IF v_vault.balance < v_total_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'رصيد الخزنة غير كافٍ',
      'code', 'INSUFFICIENT_BALANCE',
      'vault_balance', v_vault.balance,
      'required_amount', v_total_amount,
      'workers_count', v_worker_count
    );
  END IF;

  -- ═══════════════════════════════════════
  -- 4. خصم المبلغ من الخزنة
  -- ═══════════════════════════════════════
  v_new_balance := v_vault.balance - v_total_amount;

  UPDATE vaults
  SET balance = v_new_balance,
      updated_at = NOW()
  WHERE id = p_vault_id;

  -- ═══════════════════════════════════════
  -- 5. تسجيل حركة الخزنة (vault_transactions)
  -- ═══════════════════════════════════════
  INSERT INTO vault_transactions (
    vault_id, type, amount, notes,
    reference_type, reference_id,
    balance_after,
    performed_by
  ) VALUES (
    p_vault_id,
    'withdrawal',
    v_total_amount,
    'صرف رواتب شهر ' || v_period.month || '/' || v_period.year
      || ' — ' || v_worker_count || ' عامل'
      || CASE WHEN v_worker_count = 1 THEN ' (' || v_paid_names[1] || ')' ELSE '' END,
    'payroll',
    p_period_id,
    v_new_balance,
    p_disbursed_by
  );

  -- ═══════════════════════════════════════
  -- 6. إنشاء مصروف (expenses)
  -- ═══════════════════════════════════════
  SELECT id INTO v_category_id
  FROM expense_categories
  WHERE name = 'salaries'
  LIMIT 1;

  IF v_category_id IS NULL THEN
    INSERT INTO expense_categories (name, name_ar, description, requires_approval, is_active)
    VALUES ('salaries', 'رواتب', 'مسيرات رواتب العمال', false, true)
    RETURNING id INTO v_category_id;
  END IF;

  INSERT INTO expenses (
    category_id, amount, description,
    status, approved_by, approved_at, created_by
  ) VALUES (
    v_category_id,
    v_total_amount,
    'صرف رواتب شهر ' || v_period.month || '/' || v_period.year
      || ' — ' || v_worker_count || ' عامل'
      || CASE
          WHEN v_worker_count = 1 THEN ' (' || v_paid_names[1] || ')'
          ELSE ''
        END,
    'approved',
    p_disbursed_by,
    NOW(),
    p_disbursed_by
  )
  RETURNING id INTO v_expense_id;

  -- ═══════════════════════════════════════
  -- 7. تسجيل دفعة الصرف (payroll_disbursements)
  --    ⭐ هام: الـ P&L report يقرأ من هنا
  -- ═══════════════════════════════════════
  INSERT INTO payroll_disbursements (
    payroll_period_id, vault_id, amount,
    expense_id, disbursed_by, worker_ids
  ) VALUES (
    p_period_id, p_vault_id, v_total_amount,
    v_expense_id, p_disbursed_by, p_worker_ids
  )
  RETURNING id INTO v_disbursement_id;

  -- ═══════════════════════════════════════
  -- 8. تحديث بنود العمال (payroll_items)
  -- ═══════════════════════════════════════
  UPDATE payroll_items
  SET disbursed_amount = net_salary,
      payment_status = 'paid',
      updated_at = NOW()
  WHERE payroll_period_id = p_period_id
    AND worker_id = ANY(p_worker_ids)
    AND payment_status = 'unpaid'
    AND (net_salary - COALESCE(disbursed_amount, 0)) > 0;

  -- ═══════════════════════════════════════
  -- 9. تحديث إجمالى المسير وحالته
  -- ═══════════════════════════════════════
  v_new_period_disbursed := COALESCE(v_period.total_disbursed, 0) + v_total_amount;

  -- نحسب هل كل العمال مدفوع لهم الآن
  IF v_new_period_disbursed >= v_period.net_total THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partially_paid';
  END IF;

  UPDATE payroll_periods
  SET total_disbursed = v_new_period_disbursed,
      status = v_new_status,
      expense_id = v_expense_id,
      updated_at = NOW()
  WHERE id = p_period_id;

  -- ═══════════════════════════════════════
  -- 10. النتيجة
  -- ═══════════════════════════════════════
  RETURN jsonb_build_object(
    'success', true,
    'message', CASE v_new_status
      WHEN 'paid' THEN 'تم صرف المسير بالكامل'
      ELSE 'تم صرف رواتب ' || v_worker_count || ' عامل — المتبقى: '
           || (v_period.net_total - v_new_period_disbursed)
    END,
    'disbursement_id', v_disbursement_id,
    'amount_disbursed', v_total_amount,
    'workers_paid', v_worker_count,
    'worker_names', to_jsonb(v_paid_names),
    'total_disbursed', v_new_period_disbursed,
    'remaining', v_period.net_total - v_new_period_disbursed,
    'new_vault_balance', v_new_balance,
    'new_status', v_new_status
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════
-- PART 3: RLS Policies
-- ═══════════════════════════════════════════════════════════
-- payroll_items RLS already exists from migration 205
-- payroll_disbursements RLS already exists from migration 205
-- No new tables created → no new policies needed


-- ═══════════════════════════════════════════════════════════
-- PART 4: مزامنة البيانات الحالية
-- ═══════════════════════════════════════════════════════════
-- تحديث payment_status للعمال الذين صُرفت رواتبهم بالفعل
-- (عبر الصرف المجمّع القديم — نحدد حالتهم بناءً على حالة المسير)
UPDATE payroll_items pi
SET payment_status = 'paid',
    disbursed_amount = pi.net_salary
FROM payroll_periods pp
WHERE pi.payroll_period_id = pp.id
  AND pp.status = 'paid';

-- المسيرات المدفوعة جزئياً — لا نعرف أى عامل بالتحديد
-- فنتركهم unpaid (الأدمن يمكنه إعادة صرفهم فردياً)
