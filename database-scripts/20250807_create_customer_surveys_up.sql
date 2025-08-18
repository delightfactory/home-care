-- Migration: create customer_surveys table and optional survey_sent_at column on orders
-- Safe to run multiple times thanks to IF NOT EXISTS clauses

BEGIN;

-- 1. Ensure pgcrypto extension for gen_random_uuid (harmless if already installed)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Add optional column to orders table (non-intrusive)
ALTER TABLE IF EXISTS orders
    ADD COLUMN IF NOT EXISTS survey_sent_at TIMESTAMP WITH TIME ZONE;

-- 3. Create customer_surveys table
CREATE TABLE IF NOT EXISTS customer_surveys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    survey_token VARCHAR(64) UNIQUE NOT NULL,

    -- ratings 1-5
    service_quality_rating        INTEGER CHECK (service_quality_rating BETWEEN 1 AND 5),
    staff_professionalism_rating  INTEGER CHECK (staff_professionalism_rating BETWEEN 1 AND 5),
    punctuality_rating            INTEGER CHECK (punctuality_rating BETWEEN 1 AND 5),
    cleanliness_rating            INTEGER CHECK (cleanliness_rating BETWEEN 1 AND 5),
    value_for_money_rating        INTEGER CHECK (value_for_money_rating BETWEEN 1 AND 5),

    overall_rating     INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
    customer_feedback  TEXT,
    would_recommend    BOOLEAN,
    improvement_suggestions TEXT,

    -- metadata
    submitted_at TIMESTAMP WITH TIME ZONE,
    ip_address  INET,
    user_agent  TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(order_id)
);

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_surveys_order_id   ON customer_surveys(order_id);
-- تمت إزالة فهرس idx_customer_surveys_token لأن قيد UNIQUE(survey_token) ينشئ فهرسًا تلقائيًا
CREATE INDEX IF NOT EXISTS idx_customer_surveys_submitted  ON customer_surveys(submitted_at DESC) WHERE submitted_at IS NOT NULL;

-- 5. تمكين RLS وسياسات الوصول لجدول customer_surveys
SET search_path = public;

ALTER TABLE public.customer_surveys ENABLE ROW LEVEL SECURITY;

-- إزالة أى سياسات سابقة لتلافى التعارض (مقتبسة وغير مقتبسة)
DROP POLICY IF EXISTS customer_surveys_select        ON public.customer_surveys;
DROP POLICY IF EXISTS customer_surveys_select_token  ON public.customer_surveys;
DROP POLICY IF EXISTS customer_surveys_insert        ON public.customer_surveys;
DROP POLICY IF EXISTS customer_surveys_update        ON public.customer_surveys;
DROP POLICY IF EXISTS customer_surveys_update_token  ON public.customer_surveys;
DROP POLICY IF EXISTS customer_surveys_delete        ON public.customer_surveys;
DROP POLICY IF EXISTS "customer_surveys_select"     ON public.customer_surveys;
DROP POLICY IF EXISTS "customer_surveys_insert"     ON public.customer_surveys;
DROP POLICY IF EXISTS "customer_surveys_update"     ON public.customer_surveys;
DROP POLICY IF EXISTS "customer_surveys_update_token" ON public.customer_surveys;
DROP POLICY IF EXISTS "customer_surveys_delete"     ON public.customer_surveys;

-- ❶ سياسة القراءة للمستخدمين المصرَّح لهم
CREATE POLICY customer_surveys_select
  ON public.customer_surveys
  FOR SELECT
  USING (check_user_permission('orders','read'));

-- ❷ سياسة القراءة المبنية على token للزوار
CREATE POLICY customer_surveys_select_token
  ON public.customer_surveys
  FOR SELECT
  USING (
    survey_token::text = coalesce(
      current_setting('request.jwt.claim.token', true),
      current_setting('request.header.survey-token', true),
      (current_setting('request.headers', true)::json ->> 'survey-token')
    )
  );

-- ❸ سياسة الإدراج مع USING لضمان ظهور السجل بعد الإدراج
CREATE POLICY customer_surveys_insert
  ON public.customer_surveys
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR check_user_permission('orders','update')
  );

-- ❹ سياسة التحديث والحذف
CREATE POLICY customer_surveys_update
  ON public.customer_surveys
  FOR UPDATE
  USING (
    auth.role() = 'service_role' OR check_user_permission('orders','update')
  );

-- ❹-ب سياسة التحديث للزائر بالـ token (يُسمح بالتحديث مرة واحدة قبل الإرسال)
CREATE POLICY customer_surveys_update_token
  ON public.customer_surveys
  FOR UPDATE
  USING (
    survey_token::text = coalesce(
      current_setting('request.jwt.claim.token', true),
      current_setting('request.header.survey-token', true),
      (current_setting('request.headers', true)::json ->> 'survey-token')
    )
    AND submitted_at IS NULL
  )
  WITH CHECK (true);

CREATE POLICY customer_surveys_delete
  ON public.customer_surveys
  FOR DELETE
  USING (check_user_permission('orders','delete'));

-- منح الصلاحيات للزائر والمستخدم المصادق عليه على الجدول
-- إلغاء صلاحية UPDATE الكاملة ومنح أعمدة محددة فقط
REVOKE UPDATE ON public.customer_surveys FROM anon, authenticated;
GRANT SELECT ON public.customer_surveys TO anon, authenticated;
GRANT UPDATE (
  service_quality_rating,
  staff_professionalism_rating,
  punctuality_rating,
  cleanliness_rating,
  value_for_money_rating,
  overall_rating,
  customer_feedback,
  would_recommend,
  improvement_suggestions,
  submitted_at,
  ip_address,
  user_agent,
  updated_at
) ON public.customer_surveys TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_surveys TO service_role;

-- 6. تريجر مزامنة تقييم الاستبيان إلى الطلب
CREATE OR REPLACE FUNCTION sync_survey_to_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rating INTEGER;
  v_rows   INTEGER;
BEGIN
  -- يُحدث الطلب عند الإرسال لأول مرة فقط
  IF NEW.submitted_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.submitted_at IS NULL) THEN
    -- احسب التقييم الفعلي المراد تطبيقه
    v_rating := COALESCE(NEW.overall_rating, NEW.service_quality_rating);

    -- 1) تحديث تقييم الطلب إذا كان فارغًا فقط (لا يكتب فوق الموجود)
    UPDATE orders
    SET    customer_rating   = v_rating,
           customer_feedback = NEW.customer_feedback
    WHERE  id = NEW.order_id
      AND  customer_rating IS NULL;

    -- احصل على عدد الصفوف المتأثرة للتأكد من حدوث التحديث فعلاً
    GET DIAGNOSTICS v_rows = ROW_COUNT;

    -- 2) في حالة تم تحديث الطلب، قم بمزامنة التقييم مباشرةً إلى order_workers
    IF v_rows > 0 THEN
      UPDATE order_workers
      SET customer_rating = v_rating
      WHERE order_id = NEW.order_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- التريجر
DROP TRIGGER IF EXISTS trg_survey_sync ON customer_surveys;
CREATE TRIGGER trg_survey_sync
AFTER INSERT OR UPDATE OF submitted_at ON customer_surveys
FOR EACH ROW
WHEN (pg_trigger_depth() = 0)
EXECUTE FUNCTION sync_survey_to_order();

-- منح صلاحية تنفيذ الدالة لدور service_role
GRANT EXECUTE ON FUNCTION sync_survey_to_order() TO service_role;

COMMIT;
