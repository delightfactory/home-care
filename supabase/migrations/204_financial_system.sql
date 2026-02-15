-- =====================================================================
-- Migration 204: Financial Management System
-- نظام الإدارة المالية المتكامل
-- الفواتير - الخزائن - العهد
-- =====================================================================
-- ⚠️ هذا الملف يُنشئ جداول جديدة فقط — لا يعدّل أي جدول حالي
-- ⚠️ كل trigger يتبع نمط EXCEPTION — لا يكسر أي عملية أصلية
-- =====================================================================

-- ==================================
-- 1. دالة ترقيم الفاتورة التلقائي
-- ==================================
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_part TEXT;
  v_seq INT;
  v_number TEXT;
BEGIN
  v_date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  
  -- الحصول على آخر رقم تسلسلي لنفس اليوم
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM 'INV-' || v_date_part || '-(\d+)') AS INT)
  ), 0) + 1
  INTO v_seq
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || v_date_part || '-%';
  
  v_number := 'INV-' || v_date_part || '-' || LPAD(v_seq::TEXT, 3, '0');
  RETURN v_number;
END;
$$;

-- ==================================
-- 2. جدول الفواتير
-- ==================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL DEFAULT generate_invoice_number(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,  -- nullable: يدعم الفواتير اليدوية
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  
  -- المبالغ
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  
  -- الحالة
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending', 'paid', 'partially_paid', 'confirmed', 'cancelled', 'refunded'
  )),
  
  -- الدفع
  payment_method TEXT CHECK (payment_method IN ('cash', 'instapay', 'bank_transfer')),
  payment_proof_url TEXT,
  collected_by UUID REFERENCES users(id) ON DELETE SET NULL,
  collected_at TIMESTAMPTZ,
  
  -- الإلغاء
  cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  -- بيانات عامة
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهارس الفواتير
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_team_id ON invoices(team_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);

-- ==================================
-- 3. جدول بنود الفاتورة
-- ==================================
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,  -- nullable: بند حر أو خدمة محذوفة
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  total_price NUMERIC(12,2) NOT NULL CHECK (total_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهارس بنود الفاتورة
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_service_id ON invoice_items(service_id);

-- ==================================
-- 4. جدول الخزائن
-- ==================================
CREATE TABLE IF NOT EXISTS vaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'main' CHECK (type IN ('main', 'branch', 'bank')),
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================================
-- 5. جدول حركات الخزائن
-- ==================================
CREATE TABLE IF NOT EXISTS vault_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE RESTRICT,
  target_vault_id UUID REFERENCES vaults(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN (
    'deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'refund', 'collection'
  )),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  balance_after NUMERIC(14,2) NOT NULL,
  reference_type TEXT,  -- 'invoice', 'expense', 'custody_settlement', 'manual'
  reference_id UUID,
  notes TEXT,
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهارس حركات الخزائن
CREATE INDEX IF NOT EXISTS idx_vault_tx_vault_id ON vault_transactions(vault_id);
CREATE INDEX IF NOT EXISTS idx_vault_tx_type ON vault_transactions(type);
CREATE INDEX IF NOT EXISTS idx_vault_tx_created_at ON vault_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vault_tx_ref ON vault_transactions(reference_type, reference_id);

-- ==================================
-- 6. جدول حسابات العهدة
-- ==================================
CREATE TABLE IF NOT EXISTS custody_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  holder_type TEXT NOT NULL CHECK (holder_type IN ('team_leader', 'supervisor')),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)  -- مستخدم واحد = عهدة واحدة
);

-- فهارس العهد
CREATE INDEX IF NOT EXISTS idx_custody_user_id ON custody_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_custody_team_id ON custody_accounts(team_id);
CREATE INDEX IF NOT EXISTS idx_custody_is_active ON custody_accounts(is_active);

-- ==================================
-- 7. جدول حركات العهدة
-- ==================================
CREATE TABLE IF NOT EXISTS custody_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custody_id UUID NOT NULL REFERENCES custody_accounts(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN (
    'add', 'withdraw', 'collection', 'settlement_out', 'settlement_in', 'reset', 'refund'
  )),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  balance_after NUMERIC(14,2) NOT NULL,
  target_custody_id UUID REFERENCES custody_accounts(id) ON DELETE SET NULL,
  target_vault_id UUID REFERENCES vaults(id) ON DELETE SET NULL,
  reference_type TEXT,  -- 'invoice', 'manual', 'settlement'
  reference_id UUID,
  notes TEXT,
  performed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهارس حركات العهدة
CREATE INDEX IF NOT EXISTS idx_custody_tx_custody_id ON custody_transactions(custody_id);
CREATE INDEX IF NOT EXISTS idx_custody_tx_type ON custody_transactions(type);
CREATE INDEX IF NOT EXISTS idx_custody_tx_created_at ON custody_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_custody_tx_ref ON custody_transactions(reference_type, reference_id);


-- =====================================================================
-- TRIGGERS
-- =====================================================================

-- ==================================
-- T1: إنشاء فاتورة تلقائية عند إكمال الطلب
-- ==================================
CREATE OR REPLACE FUNCTION auto_create_invoice_on_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id UUID;
  v_subtotal NUMERIC(12,2) := 0;
BEGIN
  -- فقط عند التحويل لـ completed لأول مرة
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;
  
  -- فحص عدم التكرار
  IF EXISTS (SELECT 1 FROM invoices WHERE order_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  
  BEGIN
    -- حساب المجموع من بنود الطلب
    SELECT COALESCE(SUM(total_price), 0) INTO v_subtotal
    FROM order_items
    WHERE order_id = NEW.id;
    
    -- إنشاء الفاتورة
    INSERT INTO invoices (
      order_id, customer_id, team_id,
      subtotal, total_amount,
      status
    ) VALUES (
      NEW.id, NEW.customer_id, NEW.team_id,
      v_subtotal, v_subtotal,
      'pending'
    )
    RETURNING id INTO v_invoice_id;
    
    -- نسخ بنود الطلب إلى بنود الفاتورة
    INSERT INTO invoice_items (invoice_id, service_id, description, quantity, unit_price, total_price)
    SELECT 
      v_invoice_id,
      oi.service_id,
      COALESCE(s.name_ar, s.name, 'خدمة'),
      oi.quantity,
      oi.unit_price,
      oi.total_price
    FROM order_items oi
    LEFT JOIN services s ON s.id = oi.service_id
    WHERE oi.order_id = NEW.id;
    
  EXCEPTION WHEN OTHERS THEN
    -- لا نكسر إكمال الطلب أبداً
    RAISE WARNING 'auto_create_invoice failed for order %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_create_invoice ON orders;
CREATE TRIGGER trigger_auto_create_invoice
AFTER UPDATE OF status ON orders
FOR EACH ROW
WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
EXECUTE FUNCTION auto_create_invoice_on_complete();

-- ==================================
-- T2: إلغاء الفاتورة تلقائياً عند إلغاء الطلب
-- ==================================
CREATE OR REPLACE FUNCTION auto_cancel_invoice_on_order_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- فقط عند التحويل لـ cancelled
  IF NEW.status <> 'cancelled' OR OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;
  
  BEGIN
    -- إلغاء الفواتير غير المحصّلة فقط
    UPDATE invoices
    SET status = 'cancelled',
        cancelled_at = NOW(),
        cancellation_reason = 'تم إلغاء الطلب المرتبط',
        updated_at = NOW()
    WHERE order_id = NEW.id
      AND status IN ('draft', 'pending');
      
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_cancel_invoice failed for order %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_cancel_invoice_on_order_cancel ON orders;
CREATE TRIGGER trigger_auto_cancel_invoice_on_order_cancel
AFTER UPDATE OF status ON orders
FOR EACH ROW
WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')
EXECUTE FUNCTION auto_cancel_invoice_on_order_cancel();

-- ==================================
-- T3: إعادة حساب مجموع الفاتورة عند تعديل البنود
-- ==================================
CREATE OR REPLACE FUNCTION recalc_invoice_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id UUID;
  v_subtotal NUMERIC(12,2);
  v_discount NUMERIC(12,2);
BEGIN
  -- تحديد invoice_id حسب العملية
  IF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
  ELSE
    v_invoice_id := NEW.invoice_id;
  END IF;
  
  BEGIN
    -- حساب المجموع الجديد
    SELECT COALESCE(SUM(total_price), 0) INTO v_subtotal
    FROM invoice_items
    WHERE invoice_id = v_invoice_id;
    
    -- جلب الخصم الحالي
    SELECT discount INTO v_discount
    FROM invoices
    WHERE id = v_invoice_id;
    
    -- تحديث الفاتورة
    UPDATE invoices
    SET subtotal = v_subtotal,
        total_amount = GREATEST(v_subtotal - COALESCE(v_discount, 0), 0),
        updated_at = NOW()
    WHERE id = v_invoice_id;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'recalc_invoice_totals failed for invoice %: %', v_invoice_id, SQLERRM;
  END;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_recalc_invoice_totals ON invoice_items;
CREATE TRIGGER trigger_recalc_invoice_totals
AFTER INSERT OR UPDATE OR DELETE ON invoice_items
FOR EACH ROW
EXECUTE FUNCTION recalc_invoice_totals();

-- ==================================
-- T4: إدارة العهدة عند تغيير قائد الفريق
-- ==================================
CREATE OR REPLACE FUNCTION manage_custody_on_leader_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_user_id UUID;
  v_new_user_id UUID;
  v_still_leader BOOLEAN;
BEGIN
  BEGIN
    -- تجميد عهدة القائد القديم (إن وُجد)
    IF OLD.leader_id IS NOT NULL AND OLD.leader_id IS DISTINCT FROM NEW.leader_id THEN
      -- جلب user_id للقائد القديم من workers
      SELECT user_id INTO v_old_user_id
      FROM workers
      WHERE id = OLD.leader_id AND user_id IS NOT NULL;
      
      IF v_old_user_id IS NOT NULL THEN
        -- تحقق: هل لا يزال يقود فرق أخرى؟
        SELECT EXISTS(
          SELECT 1 FROM teams
          WHERE leader_id = OLD.leader_id
            AND id <> NEW.id
            AND is_active = true
        ) INTO v_still_leader;
        
        -- تجميد فقط إذا لم يعد يقود أي فريق
        IF NOT v_still_leader THEN
          UPDATE custody_accounts
          SET is_active = false, updated_at = NOW()
          WHERE user_id = v_old_user_id;
        END IF;
      END IF;
    END IF;
    
    -- تفعيل/إنشاء عهدة القائد الجديد (إن وُجد)
    IF NEW.leader_id IS NOT NULL AND NEW.leader_id IS DISTINCT FROM OLD.leader_id THEN
      -- جلب user_id للقائد الجديد من workers
      SELECT user_id INTO v_new_user_id
      FROM workers
      WHERE id = NEW.leader_id AND user_id IS NOT NULL;
      
      IF v_new_user_id IS NOT NULL THEN
        -- إنشاء أو تفعيل العهدة
        INSERT INTO custody_accounts (user_id, holder_type, team_id, is_active)
        VALUES (v_new_user_id, 'team_leader', NEW.id, true)
        ON CONFLICT (user_id) DO UPDATE
        SET is_active = true,
            team_id = NEW.id,
            holder_type = 'team_leader',
            updated_at = NOW();
      END IF;
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'manage_custody_on_leader_change failed for team %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_manage_custody_on_leader_change ON teams;
CREATE TRIGGER trigger_manage_custody_on_leader_change
AFTER UPDATE OF leader_id ON teams
FOR EACH ROW
EXECUTE FUNCTION manage_custody_on_leader_change();


-- =====================================================================
-- DB FUNCTIONS (Atomic RPC)
-- =====================================================================

-- ==================================
-- F1: تحصيل فاتورة نقدى → عهدة القائد
-- ==================================
CREATE OR REPLACE FUNCTION collect_invoice_cash(
  p_invoice_id UUID,
  p_custody_id UUID,
  p_performed_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_amount NUMERIC(12,2);
  v_new_balance NUMERIC(14,2);
BEGIN
  -- قفل الفاتورة
  SELECT * INTO v_invoice
  FROM invoices
  WHERE id = p_invoice_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الفاتورة غير موجودة');
  END IF;
  
  IF v_invoice.status NOT IN ('pending', 'partially_paid') THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يمكن تحصيل هذه الفاتورة - الحالة: ' || v_invoice.status);
  END IF;
  
  v_amount := v_invoice.total_amount - v_invoice.paid_amount;
  
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يوجد مبلغ متبقي للتحصيل');
  END IF;
  
  -- قفل العهدة وتحديث الرصيد
  SELECT balance + v_amount INTO v_new_balance
  FROM custody_accounts
  WHERE id = p_custody_id AND is_active = true
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'العهدة غير موجودة أو غير مفعّلة');
  END IF;
  
  -- تحديث رصيد العهدة
  UPDATE custody_accounts
  SET balance = v_new_balance, updated_at = NOW()
  WHERE id = p_custody_id;
  
  -- تسجيل حركة العهدة
  INSERT INTO custody_transactions (custody_id, type, amount, balance_after, reference_type, reference_id, performed_by, notes)
  VALUES (p_custody_id, 'collection', v_amount, v_new_balance, 'invoice', p_invoice_id, p_performed_by, 'تحصيل نقدى - فاتورة ' || v_invoice.invoice_number);
  
  -- تحديث الفاتورة
  UPDATE invoices
  SET paid_amount = total_amount,
      status = 'paid',
      payment_method = 'cash',
      collected_by = p_performed_by,
      collected_at = NOW(),
      updated_at = NOW()
  WHERE id = p_invoice_id;
  
  RETURN jsonb_build_object('success', true, 'amount', v_amount, 'new_balance', v_new_balance);
END;
$$;

-- ==================================
-- F2: تحصيل إداري → خزنة مباشرة
-- ==================================
CREATE OR REPLACE FUNCTION collect_invoice_admin(
  p_invoice_id UUID,
  p_vault_id UUID,
  p_payment_method TEXT,
  p_proof_url TEXT,
  p_performed_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_amount NUMERIC(12,2);
  v_new_vault_balance NUMERIC(14,2);
BEGIN
  -- التحقق من طريقة الدفع المسموحة
  IF p_payment_method NOT IN ('instapay', 'bank_transfer') THEN
    RETURN jsonb_build_object('success', false, 'error', 'طريقة الدفع غير مدعومة: ' || COALESCE(p_payment_method, 'NULL'));
  END IF;

  -- قفل الفاتورة
  SELECT * INTO v_invoice
  FROM invoices
  WHERE id = p_invoice_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الفاتورة غير موجودة');
  END IF;
  
  IF v_invoice.status NOT IN ('pending', 'partially_paid') THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يمكن تحصيل هذه الفاتورة - الحالة: ' || v_invoice.status);
  END IF;
  
  v_amount := v_invoice.total_amount - v_invoice.paid_amount;
  
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يوجد مبلغ متبقي للتحصيل');
  END IF;
  
  -- قفل الخزنة وتحديث الرصيد
  SELECT balance + v_amount INTO v_new_vault_balance
  FROM vaults
  WHERE id = p_vault_id AND is_active = true
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الخزنة غير موجودة أو غير مفعّلة');
  END IF;
  
  -- تحديث رصيد الخزنة
  UPDATE vaults
  SET balance = v_new_vault_balance, updated_at = NOW()
  WHERE id = p_vault_id;
  
  -- تسجيل حركة الخزنة
  INSERT INTO vault_transactions (vault_id, type, amount, balance_after, reference_type, reference_id, performed_by, notes)
  VALUES (p_vault_id, 'collection', v_amount, v_new_vault_balance, 'invoice', p_invoice_id, p_performed_by, 'تحصيل إداري - فاتورة ' || v_invoice.invoice_number);
  
  -- تحديث الفاتورة
  UPDATE invoices
  SET paid_amount = total_amount,
      status = 'paid',
      payment_method = p_payment_method,
      payment_proof_url = p_proof_url,
      collected_by = p_performed_by,
      collected_at = NOW(),
      updated_at = NOW()
  WHERE id = p_invoice_id;
  
  RETURN jsonb_build_object('success', true, 'amount', v_amount, 'new_vault_balance', v_new_vault_balance);
END;
$$;

-- ==================================
-- F3: تسوية عهدة → عهدة (مشرف يسحب من عهدة قائد)
-- ⚠️ الاتجاه المسموح فقط: team_leader → supervisor
-- ==================================
CREATE OR REPLACE FUNCTION settle_custody_to_custody(
  p_from_custody_id UUID,
  p_to_custody_id UUID,
  p_amount NUMERIC,
  p_performed_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_balance NUMERIC(14,2);
  v_to_balance NUMERIC(14,2);
  v_new_from_balance NUMERIC(14,2);
  v_new_to_balance NUMERIC(14,2);
  v_from_holder_type TEXT;
  v_to_holder_type TEXT;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'المبلغ يجب أن يكون أكبر من صفر');
  END IF;
  
  IF p_from_custody_id = p_to_custody_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يمكن التسوية لنفس العهدة');
  END IF;
  
  -- قفل العهدة المصدر + التحقق من النوع
  SELECT balance, holder_type INTO v_from_balance, v_from_holder_type
  FROM custody_accounts
  WHERE id = p_from_custody_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'عهدة المصدر غير موجودة');
  END IF;
  
  -- قفل العهدة الهدف + التحقق من النوع
  SELECT balance, holder_type INTO v_to_balance, v_to_holder_type
  FROM custody_accounts
  WHERE id = p_to_custody_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'عهدة الهدف غير موجودة');
  END IF;
  
  -- ⚠️ حماية أمنية: الاتجاه المسموح فقط team_leader → supervisor
  -- لا يمكن للمشرف نقل مبالغ من عهدته لعهدة الفني
  IF v_from_holder_type <> 'team_leader' OR v_to_holder_type <> 'supervisor' THEN
    RETURN jsonb_build_object('success', false, 'error', 'التسوية مسموحة فقط من عهدة قائد فريق إلى عهدة مشرف');
  END IF;
  
  IF v_from_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'رصيد العهدة غير كافٍ. الرصيد الحالي: ' || v_from_balance);
  END IF;
  
  -- الخصم من المصدر (قائد)
  v_new_from_balance := v_from_balance - p_amount;
  UPDATE custody_accounts
  SET balance = v_new_from_balance, updated_at = NOW()
  WHERE id = p_from_custody_id;
  
  -- الإضافة للهدف (مشرف)
  v_new_to_balance := v_to_balance + p_amount;
  UPDATE custody_accounts
  SET balance = v_new_to_balance, updated_at = NOW()
  WHERE id = p_to_custody_id;
  
  -- تسجيل حركة الخصم
  INSERT INTO custody_transactions (custody_id, type, amount, balance_after, target_custody_id, reference_type, performed_by, notes)
  VALUES (p_from_custody_id, 'settlement_out', p_amount, v_new_from_balance, p_to_custody_id, 'settlement', p_performed_by, 'تسوية عهدة قائد → عهدة مشرف');
  
  -- تسجيل حركة الإضافة
  INSERT INTO custody_transactions (custody_id, type, amount, balance_after, target_custody_id, reference_type, performed_by, notes)
  VALUES (p_to_custody_id, 'settlement_in', p_amount, v_new_to_balance, p_from_custody_id, 'settlement', p_performed_by, 'استلام تسوية من عهدة قائد');
  
  RETURN jsonb_build_object(
    'success', true,
    'from_new_balance', v_new_from_balance,
    'to_new_balance', v_new_to_balance
  );
END;
$$;

-- ==================================
-- F4: تسوية عهدة → خزنة
-- ==================================
CREATE OR REPLACE FUNCTION settle_custody_to_vault(
  p_custody_id UUID,
  p_vault_id UUID,
  p_amount NUMERIC,
  p_performed_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_custody_balance NUMERIC(14,2);
  v_vault_balance NUMERIC(14,2);
  v_new_custody_balance NUMERIC(14,2);
  v_new_vault_balance NUMERIC(14,2);
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'المبلغ يجب أن يكون أكبر من صفر');
  END IF;
  
  -- قفل العهدة
  SELECT balance INTO v_custody_balance
  FROM custody_accounts
  WHERE id = p_custody_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'العهدة غير موجودة');
  END IF;
  
  IF v_custody_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'رصيد العهدة غير كافٍ. الرصيد الحالي: ' || v_custody_balance);
  END IF;
  
  -- قفل الخزنة
  SELECT balance INTO v_vault_balance
  FROM vaults
  WHERE id = p_vault_id AND is_active = true
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الخزنة غير موجودة أو غير مفعّلة');
  END IF;
  
  -- الخصم من العهدة
  v_new_custody_balance := v_custody_balance - p_amount;
  UPDATE custody_accounts
  SET balance = v_new_custody_balance, updated_at = NOW()
  WHERE id = p_custody_id;
  
  -- الإضافة للخزنة
  v_new_vault_balance := v_vault_balance + p_amount;
  UPDATE vaults
  SET balance = v_new_vault_balance, updated_at = NOW()
  WHERE id = p_vault_id;
  
  -- تسجيل حركة العهدة
  INSERT INTO custody_transactions (custody_id, type, amount, balance_after, target_vault_id, reference_type, performed_by, notes)
  VALUES (p_custody_id, 'settlement_out', p_amount, v_new_custody_balance, p_vault_id, 'settlement', p_performed_by, 'تسوية عهدة → خزنة');
  
  -- تسجيل حركة الخزنة
  INSERT INTO vault_transactions (vault_id, type, amount, balance_after, reference_type, reference_id, performed_by, notes)
  VALUES (p_vault_id, 'deposit', p_amount, v_new_vault_balance, 'custody_settlement', p_custody_id, p_performed_by, 'استلام تسوية من عهدة');
  
  RETURN jsonb_build_object(
    'success', true,
    'custody_new_balance', v_new_custody_balance,
    'vault_new_balance', v_new_vault_balance
  );
END;
$$;

-- ==================================
-- F5: إلغاء فاتورة محصّلة (مع عكس الأرصدة)
-- ==================================
CREATE OR REPLACE FUNCTION cancel_paid_invoice(
  p_invoice_id UUID,
  p_reason TEXT,
  p_performed_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_custody RECORD;
  v_vault RECORD;
  v_new_balance NUMERIC(14,2);
  v_refunded BOOLEAN := false;
BEGIN
  -- قفل الفاتورة
  SELECT * INTO v_invoice
  FROM invoices
  WHERE id = p_invoice_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الفاتورة غير موجودة');
  END IF;
  
  -- فاتورة draft أو pending — إلغاء مباشر بدون عكس أرصدة
  IF v_invoice.status IN ('draft', 'pending') THEN
    UPDATE invoices
    SET status = 'cancelled',
        cancelled_by = p_performed_by,
        cancelled_at = NOW(),
        cancellation_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_invoice_id;
    
    RETURN jsonb_build_object('success', true, 'refunded', false);
  END IF;
  
  -- فاتورة محصّلة — نحتاج عكس الأرصدة
  IF v_invoice.status NOT IN ('paid', 'partially_paid', 'confirmed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يمكن إلغاء فاتورة بحالة: ' || v_invoice.status);
  END IF;
  
  -- إذا كان الدفع نقدى → خصم من عهدة المحصّل
  IF v_invoice.payment_method = 'cash' AND v_invoice.collected_by IS NOT NULL THEN
    -- البحث عن عهدة المحصّل
    SELECT * INTO v_custody
    FROM custody_accounts
    WHERE user_id = v_invoice.collected_by
    FOR UPDATE;
    
    IF FOUND THEN
      IF v_custody.balance < v_invoice.paid_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'رصيد العهدة غير كافٍ لرد المبلغ. الرصيد: ' || v_custody.balance || ' المطلوب: ' || v_invoice.paid_amount);
      END IF;
      
      v_new_balance := v_custody.balance - v_invoice.paid_amount;
      
      UPDATE custody_accounts
      SET balance = v_new_balance, updated_at = NOW()
      WHERE id = v_custody.id;
      
      INSERT INTO custody_transactions (custody_id, type, amount, balance_after, reference_type, reference_id, performed_by, notes)
      VALUES (v_custody.id, 'refund', v_invoice.paid_amount, v_new_balance, 'invoice', p_invoice_id, p_performed_by, 'رد مبلغ - إلغاء فاتورة ' || v_invoice.invoice_number);
      
      v_refunded := true;
    END IF;
    
  -- إذا كان الدفع إداري (instapay/bank_transfer) → خصم من الخزنة
  ELSIF v_invoice.payment_method IN ('instapay', 'bank_transfer') THEN
    -- البحث عن الخزنة المرتبطة بحركة التحصيل
    SELECT vt.vault_id INTO v_vault.id
    FROM vault_transactions vt
    WHERE vt.reference_type = 'invoice'
      AND vt.reference_id = p_invoice_id
      AND vt.type = 'collection'
    ORDER BY vt.created_at DESC
    LIMIT 1;
    
    IF FOUND THEN
      -- قفل الخزنة
      SELECT balance INTO v_new_balance
      FROM vaults
      WHERE id = v_vault.id
      FOR UPDATE;
      
      IF v_new_balance < v_invoice.paid_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'رصيد الخزنة غير كافٍ لرد المبلغ. الرصيد: ' || v_new_balance || ' المطلوب: ' || v_invoice.paid_amount);
      END IF;
      
      v_new_balance := v_new_balance - v_invoice.paid_amount;
      
      UPDATE vaults
      SET balance = v_new_balance, updated_at = NOW()
      WHERE id = v_vault.id;
      
      INSERT INTO vault_transactions (vault_id, type, amount, balance_after, reference_type, reference_id, performed_by, notes)
      VALUES (v_vault.id, 'refund', v_invoice.paid_amount, v_new_balance, 'invoice', p_invoice_id, p_performed_by, 'رد مبلغ - إلغاء فاتورة ' || v_invoice.invoice_number);
      
      v_refunded := true;
    END IF;
  END IF;
  
  -- تحديث الفاتورة
  UPDATE invoices
  SET status = 'cancelled',
      cancelled_by = p_performed_by,
      cancelled_at = NOW(),
      cancellation_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_invoice_id;
  
  RETURN jsonb_build_object('success', true, 'refunded', v_refunded, 'refunded_amount', CASE WHEN v_refunded THEN v_invoice.paid_amount ELSE 0 END);
END;
$$;

-- ==================================
-- F6: تحويل بين خزائن
-- ==================================
CREATE OR REPLACE FUNCTION transfer_between_vaults(
  p_from_vault_id UUID,
  p_to_vault_id UUID,
  p_amount NUMERIC,
  p_performed_by UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_balance NUMERIC(14,2);
  v_to_balance NUMERIC(14,2);
  v_new_from NUMERIC(14,2);
  v_new_to NUMERIC(14,2);
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'المبلغ يجب أن يكون أكبر من صفر');
  END IF;
  
  IF p_from_vault_id = p_to_vault_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يمكن التحويل لنفس الخزنة');
  END IF;
  
  -- قفل الخزنة المصدر
  SELECT balance INTO v_from_balance
  FROM vaults
  WHERE id = p_from_vault_id AND is_active = true
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'خزنة المصدر غير موجودة أو غير مفعّلة');
  END IF;
  
  IF v_from_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'رصيد الخزنة غير كافٍ. الرصيد: ' || v_from_balance);
  END IF;
  
  -- قفل الخزنة الهدف
  SELECT balance INTO v_to_balance
  FROM vaults
  WHERE id = p_to_vault_id AND is_active = true
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'خزنة الهدف غير موجودة أو غير مفعّلة');
  END IF;
  
  -- الخصم
  v_new_from := v_from_balance - p_amount;
  UPDATE vaults SET balance = v_new_from, updated_at = NOW() WHERE id = p_from_vault_id;
  
  -- الإضافة
  v_new_to := v_to_balance + p_amount;
  UPDATE vaults SET balance = v_new_to, updated_at = NOW() WHERE id = p_to_vault_id;
  
  -- تسجيل حركة الخصم
  INSERT INTO vault_transactions (vault_id, target_vault_id, type, amount, balance_after, reference_type, performed_by, notes)
  VALUES (p_from_vault_id, p_to_vault_id, 'transfer_out', p_amount, v_new_from, 'manual', p_performed_by, COALESCE(p_notes, 'تحويل بين خزائن'));
  
  -- تسجيل حركة الإضافة
  INSERT INTO vault_transactions (vault_id, target_vault_id, type, amount, balance_after, reference_type, performed_by, notes)
  VALUES (p_to_vault_id, p_from_vault_id, 'transfer_in', p_amount, v_new_to, 'manual', p_performed_by, COALESCE(p_notes, 'تحويل بين خزائن'));
  
  RETURN jsonb_build_object(
    'success', true,
    'from_new_balance', v_new_from,
    'to_new_balance', v_new_to
  );
END;
$$;

-- ==================================
-- F7: إحصائيات الفواتير (server-side aggregation)
-- ==================================
CREATE OR REPLACE FUNCTION get_invoice_stats(
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_invoices', COUNT(*),
    'paid_invoices', COUNT(*) FILTER (WHERE status IN ('paid', 'confirmed')),
    'pending_invoices', COUNT(*) FILTER (WHERE status = 'pending'),
    'partially_paid_invoices', COUNT(*) FILTER (WHERE status = 'partially_paid'),
    'cancelled_invoices', COUNT(*) FILTER (WHERE status = 'cancelled'),
    'total_revenue', COALESCE(SUM(paid_amount) FILTER (WHERE status IN ('paid', 'confirmed')), 0),
    'total_pending_amount', COALESCE(SUM(total_amount) FILTER (WHERE status = 'pending'), 0),
    'total_partially_paid_amount', COALESCE(SUM(paid_amount) FILTER (WHERE status = 'partially_paid'), 0),
    'total_partially_remaining', COALESCE(SUM(total_amount - paid_amount) FILTER (WHERE status = 'partially_paid'), 0),
    'cash_revenue', COALESCE(SUM(paid_amount) FILTER (WHERE status IN ('paid', 'confirmed') AND payment_method = 'cash'), 0),
    'digital_revenue', COALESCE(SUM(paid_amount) FILTER (WHERE status IN ('paid', 'confirmed') AND payment_method IN ('instapay', 'bank_transfer')), 0)
  ) INTO v_result
  FROM invoices
  WHERE (p_date_from IS NULL OR created_at >= p_date_from)
    AND (p_date_to IS NULL OR created_at <= p_date_to);

  RETURN v_result;
END;
$$;


-- =====================================================================
-- RLS POLICIES — Row Level Security
-- =====================================================================

-- الفواتير
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_invoices" ON invoices;
CREATE POLICY "authenticated_read_invoices" ON invoices FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "authenticated_insert_invoices" ON invoices;
CREATE POLICY "authenticated_insert_invoices" ON invoices FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "authenticated_update_invoices" ON invoices;
CREATE POLICY "authenticated_update_invoices" ON invoices FOR UPDATE USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "authenticated_delete_invoices" ON invoices;
CREATE POLICY "authenticated_delete_invoices" ON invoices FOR DELETE USING (auth.uid() IS NOT NULL);

-- بنود الفاتورة
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_invoice_items" ON invoice_items;
CREATE POLICY "authenticated_read_invoice_items" ON invoice_items FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "authenticated_insert_invoice_items" ON invoice_items;
CREATE POLICY "authenticated_insert_invoice_items" ON invoice_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "authenticated_update_invoice_items" ON invoice_items;
CREATE POLICY "authenticated_update_invoice_items" ON invoice_items FOR UPDATE USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "authenticated_delete_invoice_items" ON invoice_items;
CREATE POLICY "authenticated_delete_invoice_items" ON invoice_items FOR DELETE USING (auth.uid() IS NOT NULL);

-- الخزائن
ALTER TABLE vaults ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_vaults" ON vaults;
CREATE POLICY "authenticated_read_vaults" ON vaults FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "authenticated_insert_vaults" ON vaults;
CREATE POLICY "authenticated_insert_vaults" ON vaults FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "authenticated_update_vaults" ON vaults;
CREATE POLICY "authenticated_update_vaults" ON vaults FOR UPDATE USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "authenticated_delete_vaults" ON vaults;
CREATE POLICY "authenticated_delete_vaults" ON vaults FOR DELETE USING (auth.uid() IS NOT NULL);

-- حركات الخزائن
ALTER TABLE vault_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_vault_tx" ON vault_transactions;
CREATE POLICY "authenticated_read_vault_tx" ON vault_transactions FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "authenticated_insert_vault_tx" ON vault_transactions;
CREATE POLICY "authenticated_insert_vault_tx" ON vault_transactions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- حسابات العهدة
ALTER TABLE custody_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_custody" ON custody_accounts;
CREATE POLICY "authenticated_read_custody" ON custody_accounts FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "authenticated_insert_custody" ON custody_accounts;
CREATE POLICY "authenticated_insert_custody" ON custody_accounts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "authenticated_update_custody" ON custody_accounts;
CREATE POLICY "authenticated_update_custody" ON custody_accounts FOR UPDATE USING (auth.uid() IS NOT NULL);

-- حركات العهدة
ALTER TABLE custody_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_custody_tx" ON custody_transactions;
CREATE POLICY "authenticated_read_custody_tx" ON custody_transactions FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "authenticated_insert_custody_tx" ON custody_transactions;
CREATE POLICY "authenticated_insert_custody_tx" ON custody_transactions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================================
-- EXPENSE FINANCIAL INTEGRATION (دمج المصروفات مع النظام المالي)
-- =====================================================================
-- ⚠️ آمن لإعادة التشغيل — يستخدم CREATE OR REPLACE + DROP CONSTRAINT IF EXISTS
-- =====================================================================

-- ==================================
-- E1: توسيع أنواع حركات العهدة لتشمل expense
-- ==================================
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- البحث عن اسم القيد الفعلي (قد يكون مولّداً تلقائياً)
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
  WHERE con.conrelid = 'custody_transactions'::regclass
    AND con.contype = 'c'
    AND att.attname = 'type'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE custody_transactions DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  ALTER TABLE custody_transactions ADD CONSTRAINT custody_transactions_type_check
    CHECK (type IN ('add', 'withdraw', 'collection', 'settlement_out', 'settlement_in', 'reset', 'refund', 'expense'));
END $$;

-- ==================================
-- E2: توسيع أنواع حركات الخزائن لتشمل expense
-- ==================================
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
  WHERE con.conrelid = 'vault_transactions'::regclass
    AND con.contype = 'c'
    AND att.attname = 'type'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE vault_transactions DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  ALTER TABLE vault_transactions ADD CONSTRAINT vault_transactions_type_check
    CHECK (type IN ('deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'refund', 'collection', 'expense'));
END $$;

-- ==================================
-- E3: اعتماد مصروف وخصمه من عهدة المنشئ
-- ⚠️ لا يشترط أن تكون العهدة مفعّلة (is_active)
-- ⚠️ يبحث بالمنشئ (created_by) وليس القائد الحالي
-- ==================================
CREATE OR REPLACE FUNCTION approve_expense_from_custody(
  p_expense_id UUID,
  p_approved_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense RECORD;
  v_custody RECORD;
  v_new_balance NUMERIC(14,2);
BEGIN
  -- 1. قفل المصروف والتحقق من حالته
  SELECT * INTO v_expense
  FROM expenses
  WHERE id = p_expense_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'المصروف غير موجود');
  END IF;
  
  IF v_expense.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يمكن اعتماد مصروف بحالة: ' || v_expense.status);
  END IF;
  
  IF v_expense.amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'مبلغ المصروف غير صالح');
  END IF;
  
  -- 2. البحث عن عهدة المنشئ (بدون شرط is_active)
  SELECT * INTO v_custody
  FROM custody_accounts
  WHERE user_id = v_expense.created_by
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'لا توجد عهدة للمستخدم المنشئ — يرجى استخدام الخصم من الخزنة',
      'code', 'NO_CUSTODY'
    );
  END IF;
  
  -- 3. التحقق من كفاية الرصيد
  IF v_custody.balance < v_expense.amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'رصيد العهدة غير كافٍ. الرصيد الحالي: ' || v_custody.balance || ' - المطلوب: ' || v_expense.amount,
      'code', 'INSUFFICIENT_BALANCE',
      'current_balance', v_custody.balance,
      'required_amount', v_expense.amount
    );
  END IF;
  
  -- 4. خصم المبلغ من العهدة
  v_new_balance := v_custody.balance - v_expense.amount;
  UPDATE custody_accounts
  SET balance = v_new_balance, updated_at = NOW()
  WHERE id = v_custody.id;
  
  -- 5. تسجيل حركة العهدة
  INSERT INTO custody_transactions (
    custody_id, type, amount, balance_after,
    reference_type, reference_id, performed_by, notes
  ) VALUES (
    v_custody.id, 'expense', v_expense.amount, v_new_balance,
    'expense', p_expense_id, p_approved_by,
    'خصم مصروف: ' || v_expense.description
  );
  
  -- 6. تحديث حالة المصروف
  UPDATE expenses
  SET status = 'approved',
      approved_by = p_approved_by,
      approved_at = NOW(),
      updated_at = NOW()
  WHERE id = p_expense_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم اعتماد المصروف وخصمه من العهدة',
    'new_custody_balance', v_new_balance,
    'deducted_amount', v_expense.amount,
    'custody_id', v_custody.id
  );
END;
$$;

-- ==================================
-- E4: اعتماد مصروف وخصمه من خزنة (للأدمن أو عند عدم وجود عهدة)
-- ==================================
CREATE OR REPLACE FUNCTION approve_expense_from_vault(
  p_expense_id UUID,
  p_vault_id UUID,
  p_approved_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense RECORD;
  v_vault_balance NUMERIC(14,2);
  v_new_vault_balance NUMERIC(14,2);
BEGIN
  -- 1. قفل المصروف والتحقق من حالته
  SELECT * INTO v_expense
  FROM expenses
  WHERE id = p_expense_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'المصروف غير موجود');
  END IF;
  
  IF v_expense.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'لا يمكن اعتماد مصروف بحالة: ' || v_expense.status);
  END IF;
  
  IF v_expense.amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'مبلغ المصروف غير صالح');
  END IF;
  
  -- 2. قفل الخزنة والتحقق من الرصيد
  SELECT balance INTO v_vault_balance
  FROM vaults
  WHERE id = p_vault_id AND is_active = true
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الخزنة غير موجودة أو غير مفعّلة');
  END IF;
  
  IF v_vault_balance < v_expense.amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'رصيد الخزنة غير كافٍ. الرصيد الحالي: ' || v_vault_balance || ' - المطلوب: ' || v_expense.amount,
      'code', 'INSUFFICIENT_BALANCE'
    );
  END IF;
  
  -- 3. خصم من الخزنة
  v_new_vault_balance := v_vault_balance - v_expense.amount;
  UPDATE vaults
  SET balance = v_new_vault_balance, updated_at = NOW()
  WHERE id = p_vault_id;
  
  -- 4. تسجيل حركة الخزنة
  INSERT INTO vault_transactions (
    vault_id, type, amount, balance_after,
    reference_type, reference_id, performed_by, notes
  ) VALUES (
    p_vault_id, 'expense', v_expense.amount, v_new_vault_balance,
    'expense', p_expense_id, p_approved_by,
    'خصم مصروف: ' || v_expense.description
  );
  
  -- 5. تحديث حالة المصروف
  UPDATE expenses
  SET status = 'approved',
      approved_by = p_approved_by,
      approved_at = NOW(),
      updated_at = NOW()
  WHERE id = p_expense_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم اعتماد المصروف وخصمه من الخزنة',
    'new_vault_balance', v_new_vault_balance,
    'deducted_amount', v_expense.amount,
    'vault_id', p_vault_id
  );
END;
$$;


-- =====================================================================
-- DOWN MIGRATION (للتراجع الآمن — تشغيل يدوياً عند الحاجة)
-- =====================================================================
-- ⚠️ لا تُنفّذ هذه الأوامر تلقائياً — فقط عند الحاجة للتراجع
/*
-- 1. حذف Triggers
DROP TRIGGER IF EXISTS trigger_auto_create_invoice ON orders;
DROP TRIGGER IF EXISTS trigger_auto_cancel_invoice_on_order_cancel ON orders;
DROP TRIGGER IF EXISTS trigger_recalc_invoice_totals ON invoice_items;
DROP TRIGGER IF EXISTS trigger_manage_custody_on_leader_change ON teams;

-- 2. حذف Functions
DROP FUNCTION IF EXISTS auto_create_invoice_on_complete();
DROP FUNCTION IF EXISTS auto_cancel_invoice_on_order_cancel();
DROP FUNCTION IF EXISTS recalc_invoice_totals();
DROP FUNCTION IF EXISTS manage_custody_on_leader_change();
DROP FUNCTION IF EXISTS collect_invoice_cash(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS collect_invoice_admin(UUID, UUID, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS settle_custody_to_custody(UUID, UUID, NUMERIC, UUID);
DROP FUNCTION IF EXISTS settle_custody_to_vault(UUID, UUID, NUMERIC, UUID);
DROP FUNCTION IF EXISTS cancel_paid_invoice(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS transfer_between_vaults(UUID, UUID, NUMERIC, UUID, TEXT);
DROP FUNCTION IF EXISTS get_invoice_stats(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS generate_invoice_number();

-- 3. حذف الجداول (بالترتيب العكسي — التبعيات أولاً)
DROP TABLE IF EXISTS custody_transactions CASCADE;
DROP TABLE IF EXISTS custody_accounts CASCADE;
DROP TABLE IF EXISTS vault_transactions CASCADE;
DROP TABLE IF EXISTS vaults CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
*/
