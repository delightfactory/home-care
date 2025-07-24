-- =========================================================
-- إصلاح مشكلة Materialized Views - Home Care App
-- =========================================================
-- هذا السكريبت يحل مشكلة "cannot refresh materialized view concurrently"
-- عبر إنشاء فهارس فريدة مطلوبة للتحديث المتزامن

-- ---------------------------------------------------------
-- 1. إصلاح mv_weekly_stats
-- ---------------------------------------------------------

-- حذف الفهرس العادي الموجود
DROP INDEX IF EXISTS idx_mv_weekly_stats_start;

-- إنشاء فهرس فريد على week_start (مطلوب للتحديث المتزامن)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_weekly_stats_week_start_unique 
ON mv_weekly_stats (week_start);

-- ---------------------------------------------------------
-- 2. إصلاح mv_quarterly_stats
-- ---------------------------------------------------------

-- حذف الفهرس العادي الموجود
DROP INDEX IF EXISTS idx_mv_quarterly_stats_start;

-- إنشاء فهرس فريد على quarter_start (مطلوب للتحديث المتزامن)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_quarterly_stats_quarter_start_unique 
ON mv_quarterly_stats (quarter_start);

-- ---------------------------------------------------------
-- 3. إصلاح mv_monthly_stats (إذا كانت موجودة)
-- ---------------------------------------------------------

-- حذف الفهرس العادي الموجود
DROP INDEX IF EXISTS idx_mv_monthly_stats_month;

-- إنشاء فهرس فريد على month_date (مطلوب للتحديث المتزامن)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_monthly_stats_month_date_unique 
ON mv_monthly_stats (month_date);

-- ---------------------------------------------------------
-- 4. إصلاح mv_top_customers (إذا كانت موجودة)
-- ---------------------------------------------------------

-- حذف الفهرس العادي الموجود
DROP INDEX IF EXISTS idx_mv_top_customers_spent;

-- إنشاء فهرس فريد على id (مطلوب للتحديث المتزامن)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_top_customers_id_unique 
ON mv_top_customers (id);

-- ---------------------------------------------------------
-- 5. تحديث دوال التحديث لتتعامل مع الأخطاء
-- ---------------------------------------------------------

-- تحديث دالة refresh_weekly_stats مع معالجة الأخطاء
CREATE OR REPLACE FUNCTION refresh_weekly_stats() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_weekly_stats;
  EXCEPTION
    WHEN OTHERS THEN
      -- في حالة فشل التحديث المتزامن، نستخدم التحديث العادي
      REFRESH MATERIALIZED VIEW mv_weekly_stats;
  END;
END;
$$;

-- تحديث دالة refresh_quarterly_stats مع معالجة الأخطاء
CREATE OR REPLACE FUNCTION refresh_quarterly_stats() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_quarterly_stats;
  EXCEPTION
    WHEN OTHERS THEN
      -- في حالة فشل التحديث المتزامن، نستخدم التحديث العادي
      REFRESH MATERIALIZED VIEW mv_quarterly_stats;
  END;
END;
$$;

-- تحديث دالة refresh_monthly_stats مع معالجة الأخطاء (إذا كانت موجودة)
CREATE OR REPLACE FUNCTION refresh_monthly_stats() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_stats;
  EXCEPTION
    WHEN OTHERS THEN
      -- في حالة فشل التحديث المتزامن، نستخدم التحديث العادي
      REFRESH MATERIALIZED VIEW mv_monthly_stats;
  END;
END;
$$;

-- تحديث دالة refresh_top_customers مع معالجة الأخطاء (إذا كانت موجودة)
CREATE OR REPLACE FUNCTION refresh_top_customers() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_customers;
  EXCEPTION
    WHEN OTHERS THEN
      -- في حالة فشل التحديث المتزامن، نستخدم التحديث العادي
      REFRESH MATERIALIZED VIEW mv_top_customers;
  END;
END;
$$;

-- ---------------------------------------------------------
-- 6. إنشاء دالة شاملة لتحديث جميع المادة فيوز
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION refresh_all_materialized_views_safe() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- تحديث الإحصائيات الأسبوعية
  PERFORM refresh_weekly_stats();
  
  -- تحديث الإحصائيات الربعية
  PERFORM refresh_quarterly_stats();
  
  -- تحديث الإحصائيات الشهرية (إذا كانت موجودة)
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_monthly_stats') THEN
    PERFORM refresh_monthly_stats();
  END IF;
  
  -- تحديث أفضل العملاء (إذا كانت موجودة)
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_top_customers') THEN
    PERFORM refresh_top_customers();
  END IF;
  
  -- تحديث إحصائيات الجداول
  ANALYZE mv_weekly_stats;
  ANALYZE mv_quarterly_stats;
  
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_monthly_stats') THEN
    ANALYZE mv_monthly_stats;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_top_customers') THEN
    ANALYZE mv_top_customers;
  END IF;
END;
$$;

-- ---------------------------------------------------------
-- 7. منح الصلاحيات للدوال الجديدة
-- ---------------------------------------------------------

GRANT EXECUTE ON FUNCTION refresh_weekly_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_quarterly_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_monthly_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_top_customers() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_all_materialized_views_safe() TO authenticated;

-- ---------------------------------------------------------
-- 8. اختبار التحديث
-- ---------------------------------------------------------

-- اختبار تحديث الإحصائيات الأسبوعية
-- SELECT refresh_weekly_stats();

-- اختبار تحديث الإحصائيات الربعية
-- SELECT refresh_quarterly_stats();

-- اختبار تحديث جميع المادة فيوز
-- SELECT refresh_all_materialized_views_safe();

-- ---------------------------------------------------------
-- 9. ملاحظات مهمة
-- ---------------------------------------------------------

/*
ملاحظات مهمة بعد تطبيق هذا السكريبت:

1. الفهارس الفريدة:
   - تم إنشاء فهارس فريدة على الأعمدة الرئيسية لكل materialized view
   - هذا يمكن التحديث المتزامن (CONCURRENTLY) دون قفل الجدول

2. معالجة الأخطاء:
   - تم تحديث دوال التحديث لتتعامل مع الأخطاء
   - في حالة فشل التحديث المتزامن، يتم استخدام التحديث العادي

3. الأداء:
   - التحديث المتزامن أبطأ لكنه لا يقفل الجدول
   - التحديث العادي أسرع لكنه يقفل الجدول مؤقتاً

4. الاستخدام:
   - استخدم refresh_all_materialized_views_safe() بدلاً من الدوال الفردية
   - هذه الدالة تتحقق من وجود المادة فيوز قبل التحديث

5. الجدولة:
   - يمكن جدولة refresh_all_materialized_views_safe() يومياً
   - مثال: SELECT cron.schedule('refresh-views', '0 2 * * *', 'SELECT refresh_all_materialized_views_safe();');
*/

-- تم الانتهاء من إصلاح مشكلة Materialized Views