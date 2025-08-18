-- Rollback migration: drop customer_surveys table and survey_sent_at column
-- Safe to run even if elements already absent thanks to IF EXISTS clauses

BEGIN;

-- 1. إزالة سياسات RLS المتعلقة بجدول customer_surveys (إن وُجد) قبل حذف الجدول
DROP POLICY IF EXISTS "customer_surveys_select"  ON customer_surveys;
DROP POLICY IF EXISTS customer_surveys_select_token  ON customer_surveys;
DROP POLICY IF EXISTS customer_surveys_insert        ON customer_surveys;
DROP POLICY IF EXISTS "customer_surveys_update"  ON customer_surveys;
DROP POLICY IF EXISTS customer_surveys_update_token  ON customer_surveys;
DROP POLICY IF EXISTS "customer_surveys_update_token" ON customer_surveys;
DROP POLICY IF EXISTS "customer_surveys_delete"  ON customer_surveys;

-- إسقاط التريجر والدالة الخاصة بمزامنة التقييم
DROP TRIGGER IF EXISTS trg_survey_sync ON customer_surveys;
DROP FUNCTION IF EXISTS sync_survey_to_order();

-- 2. إزالة تمكين RLS إن لزم
ALTER TABLE IF EXISTS customer_surveys DISABLE ROW LEVEL SECURITY;

-- 3. حذف الجدول فى النهاية إذا كان موجوداً
DROP TABLE IF EXISTS customer_surveys CASCADE;

-- 2. Remove optional column from orders table (if it exists)
ALTER TABLE IF EXISTS orders
    DROP COLUMN IF EXISTS survey_sent_at;

COMMIT;
