-- =====================================================================
-- Migration 214: Manual Vault Adjustment (إيداع/سحب يدوي من الخزنة)
-- =====================================================================

CREATE OR REPLACE FUNCTION manual_vault_adjustment(
  p_vault_id UUID,
  p_amount NUMERIC,
  p_type TEXT,          -- 'deposit' أو 'withdrawal'
  p_notes TEXT,
  p_performed_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vault_balance NUMERIC(14,2);
  v_new_balance NUMERIC(14,2);
  v_vault_name TEXT;
BEGIN
  -- التحقق من المبلغ
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'المبلغ يجب أن يكون أكبر من صفر');
  END IF;

  -- التحقق من النوع
  IF p_type NOT IN ('deposit', 'withdrawal') THEN
    RETURN jsonb_build_object('success', false, 'error', 'النوع يجب أن يكون deposit أو withdrawal');
  END IF;

  -- التحقق من الملاحظات
  IF p_notes IS NULL OR TRIM(p_notes) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'يجب إدخال سبب/ملاحظات للعملية');
  END IF;

  -- قفل الخزنة
  SELECT balance, name_ar INTO v_vault_balance, v_vault_name
  FROM vaults
  WHERE id = p_vault_id AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الخزنة غير موجودة أو غير مفعّلة');
  END IF;

  -- حساب الرصيد الجديد
  IF p_type = 'deposit' THEN
    v_new_balance := v_vault_balance + p_amount;
  ELSE
    -- التحقق من كفاية الرصيد
    IF v_vault_balance < p_amount THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'رصيد الخزنة غير كافٍ. الرصيد الحالي: ' || v_vault_balance
      );
    END IF;
    v_new_balance := v_vault_balance - p_amount;
  END IF;

  -- تحديث رصيد الخزنة
  UPDATE vaults
  SET balance = v_new_balance, updated_at = NOW()
  WHERE id = p_vault_id;

  -- تسجيل حركة الخزنة
  INSERT INTO vault_transactions (
    vault_id, type, amount, balance_after,
    reference_type, notes, performed_by
  ) VALUES (
    p_vault_id, p_type, p_amount, v_new_balance,
    'manual_adjustment', p_notes, p_performed_by
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'vault_name', v_vault_name
  );
END;
$$;
