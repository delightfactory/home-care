-- =========================================================
-- Migration 217: Fix invoice team_id assignment
-- 
-- Problem: addOrderToRoute لم يكن يعيّن team_id على الطلب
--          فعند إكمال الطلب ينشئ الـ trigger فاتورة بـ team_id = NULL
--
-- Fix 1: تحسين الـ trigger ليبحث عن الفريق من خط السير إذا كان team_id فارغ
-- Fix 2: إصلاح الفواتير الحالية (37 فاتورة)
-- =========================================================

-- ==================================
-- 1. تحسين trigger إنشاء الفاتورة التلقائية
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
  v_team_id UUID;
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
    -- تحديد الفريق: من الطلب مباشرة أو من خط السير (fallback)
    v_team_id := NEW.team_id;
    
    IF v_team_id IS NULL THEN
      SELECT r.team_id INTO v_team_id
      FROM route_orders ro
      JOIN routes r ON r.id = ro.route_id
      WHERE ro.order_id = NEW.id
      LIMIT 1;
    END IF;
    
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
      NEW.id, NEW.customer_id, v_team_id,
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


-- ==================================
-- 2. إصلاح الفواتير الحالية
--    تحديث team_id من الطلب المرتبط
-- ==================================
UPDATE invoices i
SET team_id = o.team_id,
    updated_at = NOW()
FROM orders o
WHERE o.id = i.order_id
  AND i.team_id IS NULL
  AND o.team_id IS NOT NULL;


-- ==================================
-- 3. إصلاح إضافي: الفواتير اللي الطلب بتاعها
--    كمان مالوش فريق — نجيبه من خط السير
-- ==================================
UPDATE invoices i
SET team_id = r.team_id,
    updated_at = NOW()
FROM orders o
JOIN route_orders ro ON ro.order_id = o.id
JOIN routes r ON r.id = ro.route_id
WHERE o.id = i.order_id
  AND i.team_id IS NULL
  AND o.team_id IS NULL
  AND r.team_id IS NOT NULL;
