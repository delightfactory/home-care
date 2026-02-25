-- =====================================================================
-- Migration 216: اعتماد السلف من العهدة + تحسين الإلغاء
-- =====================================================================
-- ⚠️ آمن لإعادة التشغيل — يستخدم IF NOT EXISTS + CREATE OR REPLACE
-- =====================================================================


-- =====================================================================
-- PART 1: إضافة عمود custody_id لجدول salary_advances
-- =====================================================================

ALTER TABLE salary_advances ADD COLUMN IF NOT EXISTS custody_id UUID
  REFERENCES custody_accounts(id) ON DELETE SET NULL;


-- =====================================================================
-- PART 2: اعتماد سلفة وخصمها من عهدة المنشئ — دالة ذرية
-- =====================================================================
-- ⚠️ نفس نمط approve_expense_from_custody (204_financial_system.sql)
-- ⚠️ لا تعدّل approve_advance_from_vault — تبقى كما هى كـ fallback
-- =====================================================================

CREATE OR REPLACE FUNCTION approve_advance_from_custody(
  p_advance_id UUID,
  p_approved_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_advance RECORD;
  v_custody RECORD;
  v_new_balance NUMERIC(14,2);
  v_category_id UUID;
  v_worker_name TEXT;
  v_period_id UUID;
BEGIN
  -- 1. قفل السلفة والتحقق من حالتها
  SELECT * INTO v_advance
  FROM salary_advances
  WHERE id = p_advance_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'السلفة غير موجودة');
  END IF;

  IF v_advance.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'السلفة ليست فى حالة معلقة — الحالة الحالية: ' || v_advance.status);
  END IF;

  IF v_advance.total_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'مبلغ السلفة غير صالح');
  END IF;

  -- 2. البحث عن عهدة المنشئ (بدون شرط is_active — مثل المصروفات)
  SELECT * INTO v_custody
  FROM custody_accounts
  WHERE user_id = v_advance.created_by
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'لا توجد عهدة للمستخدم المنشئ — يرجى استخدام الخصم من الخزنة',
      'code', 'NO_CUSTODY'
    );
  END IF;

  -- 3. التحقق من كفاية الرصيد
  IF v_custody.balance < v_advance.total_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'رصيد العهدة غير كافٍ. الرصيد الحالي: ' || v_custody.balance || ' - المطلوب: ' || v_advance.total_amount,
      'code', 'INSUFFICIENT_BALANCE',
      'current_balance', v_custody.balance,
      'required_amount', v_advance.total_amount
    );
  END IF;

  -- 4. خصم المبلغ من العهدة
  v_new_balance := v_custody.balance - v_advance.total_amount;
  UPDATE custody_accounts
  SET balance = v_new_balance, updated_at = NOW()
  WHERE id = v_custody.id;

  -- 5. تسجيل حركة العهدة
  INSERT INTO custody_transactions (
    custody_id, type, amount, balance_after,
    reference_type, reference_id, performed_by, notes
  ) VALUES (
    v_custody.id, 'expense', v_advance.total_amount, v_new_balance,
    'salary_advance', p_advance_id, p_approved_by,
    'صرف سلفة — ' || COALESCE(v_advance.reason, 'بدون سبب')
  );

  -- 6. ⭐ تسجيل السلفة كمصروف (مصروف مقدم) — نفس منطق approve_advance_from_vault
  SELECT name INTO v_worker_name FROM workers WHERE id = v_advance.worker_id;

  SELECT id INTO v_category_id
  FROM expense_categories
  WHERE name = 'salary_advances'
  LIMIT 1;

  IF v_category_id IS NULL THEN
    INSERT INTO expense_categories (name, name_ar, description, requires_approval, is_active)
    VALUES ('salary_advances', 'سلف مقدمة', 'سلف رواتب مصروفة للعمال', false, true)
    RETURNING id INTO v_category_id;
  END IF;

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
    v_advance.total_amount,
    'سلفة — ' || COALESCE(v_worker_name, 'عامل') || ' — ' || COALESCE(v_advance.reason, 'بدون سبب'),
    'approved',
    p_approved_by,
    NOW(),
    p_approved_by
  );

  -- 7. تحديث حالة السلفة — custody_id + بدون vault_id
  UPDATE salary_advances
  SET status = 'active',
      custody_id = v_custody.id,
      vault_id = NULL,
      approved_by = p_approved_by,
      updated_at = NOW()
  WHERE id = p_advance_id;

  -- 8. ⭐ إعادة حساب المسير تلقائياً إذا كان موجوداً وغير معتمد
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
    'message', 'تم اعتماد السلفة وخصمها من العهدة بنجاح',
    'new_custody_balance', v_new_balance,
    'deducted_amount', v_advance.total_amount,
    'custody_id', v_custody.id
  );
END;
$$;


-- =====================================================================
-- PART 3: تعديل cancel_advance_with_refund — دعم الاسترداد للعهدة
-- =====================================================================
-- ⚠️ CREATE OR REPLACE — آمن لإعادة التشغيل
-- ⚠️ المنطق: إذا custody_id IS NOT NULL → رد للعهدة
--           إذا vault_id IS NOT NULL   → رد للخزنة (كالسابق)
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
  v_custody RECORD;
  v_refund_amount NUMERIC(12,2);
  v_new_balance NUMERIC(12,2);
  v_worker_name TEXT;
  v_period_id UUID;
  v_refund_target TEXT := 'none';
BEGIN
  -- 1. جلب السلفة والتحقق من حالتها
  SELECT * INTO v_advance FROM salary_advances WHERE id = p_advance_id FOR UPDATE;

  IF v_advance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'السلفة غير موجودة');
  END IF;

  -- نسمح بالإلغاء فقط للسلف النشطة (المصروفة) أو المعلقة
  IF v_advance.status NOT IN ('active', 'pending') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'لا يمكن إلغاء سلفة بحالة "' || v_advance.status || '"'
    );
  END IF;

  -- 2. المبلغ المُسترد = المتبقى من السلفة
  v_refund_amount := GREATEST(0, v_advance.remaining_amount);

  -- اسم العامل للوصف
  SELECT name INTO v_worker_name FROM workers WHERE id = v_advance.worker_id;

  -- 3. إعادة المبلغ للمصدر الأصلي
  IF v_refund_amount > 0 THEN

    -- الفرع أ: السلفة مصروفة من عهدة
    IF v_advance.custody_id IS NOT NULL AND v_advance.vault_id IS NULL THEN
      SELECT * INTO v_custody FROM custody_accounts WHERE id = v_advance.custody_id FOR UPDATE;

      IF v_custody IS NOT NULL THEN
        v_new_balance := v_custody.balance + v_refund_amount;

        UPDATE custody_accounts
        SET balance = v_new_balance,
            updated_at = NOW()
        WHERE id = v_advance.custody_id;

        -- تسجيل حركة إضافة (استرداد) فى العهدة
        INSERT INTO custody_transactions (
          custody_id, type, amount, balance_after,
          reference_type, reference_id, performed_by, notes
        ) VALUES (
          v_advance.custody_id,
          'add',
          v_refund_amount,
          v_new_balance,
          'salary_advance',
          p_advance_id,
          p_cancelled_by,
          'استرداد سلفة مُلغاة — ' || COALESCE(v_worker_name, 'عامل') || ' — ' || COALESCE(v_advance.reason, 'بدون سبب')
        );

        v_refund_target := 'custody';
      END IF;

    -- الفرع ب: السلفة مصروفة من خزنة (السلوك الأصلي)
    ELSIF v_advance.vault_id IS NOT NULL THEN
      SELECT * INTO v_vault FROM vaults WHERE id = v_advance.vault_id FOR UPDATE;

      IF v_vault IS NOT NULL THEN
        v_new_balance := v_vault.balance + v_refund_amount;

        UPDATE vaults
        SET balance = v_new_balance,
            updated_at = NOW()
        WHERE id = v_advance.vault_id;

        -- تسجيل حركة إيداع (استرداد) فى الخزنة
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

        v_refund_target := 'vault';
      END IF;
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
    'message', CASE
      WHEN v_refund_target = 'custody' THEN 'تم إلغاء السلفة واسترداد ' || v_refund_amount || ' ج.م إلى العهدة'
      WHEN v_refund_target = 'vault' THEN 'تم إلغاء السلفة واسترداد ' || v_refund_amount || ' ج.م إلى الخزنة'
      ELSE 'تم إلغاء السلفة'
    END,
    'refund_amount', v_refund_amount,
    'refund_target', v_refund_target,
    'vault_id', v_advance.vault_id,
    'custody_id', v_advance.custody_id,
    'new_balance', v_new_balance
  );
END;
$$;


-- =====================================================================
-- PART 4: تعديل get_profit_loss_report — إضافة سلف العهدة
-- =====================================================================
-- ⚠️ CREATE OR REPLACE — آمن لإعادة التشغيل
-- ⚠️ القسم 4 (السلف): UNION ALL بين vault_transactions + custody_transactions
-- ⚠️ يضيف source_name + source_type للتفريق فى الواجهة
-- =====================================================================

CREATE OR REPLACE FUNCTION get_profit_loss_report(
  p_date_from DATE,
  p_date_to DATE
)
RETURNS TABLE (
  total_revenue NUMERIC(14,2),
  total_expenses NUMERIC(14,2),
  total_payroll NUMERIC(14,2),
  total_advances NUMERIC(14,2),
  net_profit NUMERIC(14,2),
  revenue_details JSONB,
  expense_details JSONB,
  payroll_details JSONB,
  advance_details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_revenue NUMERIC(14,2);
  v_total_expenses NUMERIC(14,2);
  v_total_payroll NUMERIC(14,2);
  v_total_advances NUMERIC(14,2);
  v_revenue_details JSONB;
  v_expense_details JSONB;
  v_payroll_details JSONB;
  v_advance_details JSONB;
BEGIN
  -- ════════════════════════════════════════════
  -- 1. الإيرادات (كما هى)
  -- ════════════════════════════════════════════
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

  -- ════════════════════════════════════════════
  -- 2. المصروفات (باستثناء الرواتب والسلف — يُعرضان منفصلين)
  -- ════════════════════════════════════════════
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
    AND ec.name IS DISTINCT FROM 'salaries'
    AND ec.name IS DISTINCT FROM 'salary_advances';

  -- ════════════════════════════════════════════
  -- 3. الرواتب المصروفة فعلياً (من payroll_disbursements)
  -- ════════════════════════════════════════════
  SELECT
    COALESCE(SUM(pd.amount), 0),
    COALESCE(
      jsonb_agg(jsonb_build_object(
        'id', pd.id,
        'month', pp.month,
        'year', pp.year,
        'amount', pd.amount,
        'net_total', pp.net_total,
        'total_disbursed', pp.total_disbursed,
        'total_salaries', pp.total_salaries,
        'total_incentives', pp.total_incentives,
        'total_deductions', pp.total_deductions,
        'total_advances', pp.total_advances,
        'total_absence_deductions', pp.total_absence_deductions,
        'status', pp.status,
        'date', pd.created_at::DATE
      ) ORDER BY pd.created_at DESC),
      '[]'::JSONB
    )
  INTO v_total_payroll, v_payroll_details
  FROM payroll_disbursements pd
  JOIN payroll_periods pp ON pp.id = pd.payroll_period_id
  WHERE pd.created_at::DATE BETWEEN p_date_from AND p_date_to;

  -- ════════════════════════════════════════════
  -- 4. ⭐ السلف المصروفة (خزنة + عهدة)
  --    UNION ALL بين vault_transactions و custody_transactions
  -- ════════════════════════════════════════════
  SELECT
    COALESCE(SUM(combined.amount), 0),
    COALESCE(
      jsonb_agg(jsonb_build_object(
        'id', combined.tx_id,
        'amount', combined.amount,
        'notes', combined.notes,
        'source_name', combined.source_name,
        'source_type', combined.source_type,
        'vault_name', combined.source_name,
        'date', combined.tx_date,
        'worker_name', combined.worker_name
      ) ORDER BY combined.tx_date DESC),
      '[]'::JSONB
    )
  INTO v_total_advances, v_advance_details
  FROM (
    -- الفرع أ: سلف مصروفة من خزنة
    SELECT
      vt.id AS tx_id,
      vt.amount,
      vt.notes,
      v.name AS source_name,
      'vault' AS source_type,
      vt.created_at::DATE AS tx_date,
      COALESCE(w.name, 'غير معروف') AS worker_name
    FROM vault_transactions vt
    JOIN vaults v ON v.id = vt.vault_id
    INNER JOIN salary_advances sa ON sa.id = vt.reference_id
    LEFT JOIN workers w ON w.id = sa.worker_id
    WHERE vt.reference_type = 'salary_advance'
      AND vt.type = 'withdrawal'
      AND vt.created_at::DATE BETWEEN p_date_from AND p_date_to
      AND sa.status IN ('active', 'completed')

    UNION ALL

    -- الفرع ب: سلف مصروفة من عهدة
    SELECT
      ct.id AS tx_id,
      ct.amount,
      ct.notes,
      COALESCE(cu.full_name, 'عهدة') AS source_name,
      'custody' AS source_type,
      ct.created_at::DATE AS tx_date,
      COALESCE(w.name, 'غير معروف') AS worker_name
    FROM custody_transactions ct
    JOIN custody_accounts ca ON ca.id = ct.custody_id
    LEFT JOIN users cu ON cu.id = ca.user_id
    INNER JOIN salary_advances sa ON sa.id = ct.reference_id
    LEFT JOIN workers w ON w.id = sa.worker_id
    WHERE ct.reference_type = 'salary_advance'
      AND ct.type = 'expense'
      AND ct.created_at::DATE BETWEEN p_date_from AND p_date_to
      AND sa.status IN ('active', 'completed')
  ) combined;

  -- ════════════════════════════════════════════
  -- 5. حساب صافى الربح
  -- ════════════════════════════════════════════
  RETURN QUERY SELECT
    v_total_revenue,
    v_total_expenses,
    v_total_payroll,
    v_total_advances,
    v_total_revenue - v_total_expenses - v_total_payroll - v_total_advances,
    v_revenue_details,
    v_expense_details,
    v_payroll_details,
    v_advance_details;
END;
$$;
