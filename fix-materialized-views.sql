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










/* ==============================================================
   1. الإعدادات العامة
   ============================================================== */
-- اجعل البحث في المخطط العام فقط
SET search_path = public;

-- نتأكد من وجود دالة get_week_start_eg (مُعرّفة سابقاً)
-- وإلا ننشئها سريعاً (لن تُنفّذ إذا كانت موجودة)
CREATE OR REPLACE FUNCTION get_week_start_eg(p_date date)
RETURNS date LANGUAGE sql IMMUTABLE AS $$
  SELECT date_trunc('week', p_date + INTERVAL '1 day')::date - INTERVAL '1 day';
$$;

/* ==============================================================
   2. دالة إرجاع التقارير اليومية فى نطاق تاريخ
   ============================================================== */
CREATE OR REPLACE FUNCTION rpc_daily_reports_range(
  p_start_date  date,
  p_end_date    date
)
RETURNS SETOF daily_reports
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT *
  FROM   daily_reports
  WHERE  report_date BETWEEN p_start_date AND p_end_date
  ORDER  BY report_date;
$$;

COMMENT ON FUNCTION rpc_daily_reports_range IS
'ترجع كل سجلات daily_reports بين تاريخين محدّدين (شاملين)';

/* ==============================================================
   3. دالة ملخص Dashboard مجمَّع لنطاق تاريخ
   ============================================================== */
CREATE OR REPLACE FUNCTION rpc_dashboard_summary_range(
  p_start_date  date,
  p_end_date    date
)
RETURNS TABLE (
  total_orders        integer,
  completed_orders    integer,
  cancelled_orders    integer,
  total_revenue       numeric,
  total_expenses      numeric,
  net_profit          numeric,
  active_teams        integer,
  average_rating      numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
      SUM(total_orders)      AS total_orders,
      SUM(completed_orders)  AS completed_orders,
      SUM(cancelled_orders)  AS cancelled_orders,
      SUM(total_revenue)     AS total_revenue,
      SUM(total_expenses)    AS total_expenses,
      SUM(net_profit)        AS net_profit,
      MAX(active_teams)      AS active_teams,
      AVG(average_rating)    AS average_rating
  FROM daily_reports
  WHERE report_date BETWEEN p_start_date AND p_end_date;
$$;

COMMENT ON FUNCTION rpc_dashboard_summary_range IS
'Dashboard مجمّع (من daily_reports) لفترة زمنية يحددها المستخدم';

/* ==============================================================
   4. دالة إحصائيات أسبوعية مرنة
   ============================================================== */
CREATE OR REPLACE FUNCTION rpc_weekly_stats_range(
  p_start_date  date,
  p_end_date    date
)
RETURNS TABLE (
  week_start        date,
  total_orders      integer,
  completed_orders  integer,
  cancelled_orders  integer,
  total_revenue     numeric,
  total_expenses    numeric,
  net_profit        numeric,
  avg_rating        numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
      get_week_start_eg(report_date)      AS week_start,
      COUNT(*)                            AS total_orders,
      COUNT(*) FILTER (WHERE completed_orders > 0) AS completed_orders,
      COUNT(*) FILTER (WHERE cancelled_orders > 0) AS cancelled_orders,
      SUM(total_revenue)                  AS total_revenue,
      SUM(total_expenses)                 AS total_expenses,
      SUM(net_profit)                     AS net_profit,
      AVG(average_rating)                 AS avg_rating
  FROM daily_reports
  WHERE report_date BETWEEN p_start_date AND p_end_date
  GROUP BY week_start
  ORDER BY week_start DESC;
$$;

COMMENT ON FUNCTION rpc_weekly_stats_range IS
'تجميع أسبوعي ديناميكي مبني على daily_reports لنطاق تاريخ مخصّص';

/* ==============================================================
   5. دالة أداء الفريق فى نطاق تاريخ
   ============================================================== */
CREATE OR REPLACE FUNCTION rpc_team_performance_range(
  p_start_date  date,
  p_end_date    date
)
RETURNS TABLE (
  team_id            uuid,
  team_name          text,
  orders_completed   integer,
  total_revenue      numeric,
  total_expenses     numeric,
  average_rating     numeric,
  efficiency_score   numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
      t.id                                 AS team_id,
      t.name                               AS team_name,
      SUM(tp.orders_completed)             AS orders_completed,
      SUM(tp.total_revenue)                AS total_revenue,
      SUM(tp.total_expenses)               AS total_expenses,
      AVG(tp.average_rating)               AS average_rating,
      AVG(tp.efficiency_score)             AS efficiency_score
  FROM team_performance tp
  JOIN teams t ON t.id = tp.team_id
  WHERE tp.date BETWEEN p_start_date AND p_end_date
  GROUP BY t.id, t.name
  ORDER BY orders_completed DESC;
$$;

COMMENT ON FUNCTION rpc_team_performance_range IS
'إحصائيات الفريق مجمّعة لفترة زمنية محددة بناءً على جدول team_performance';

/* ==============================================================
   6. الصلاحيات
   ============================================================== */
GRANT EXECUTE ON FUNCTION
    rpc_daily_reports_range,
    rpc_dashboard_summary_range,
    rpc_weekly_stats_range,
    rpc_team_performance_range
TO authenticated, anon;

/* ==============================================================
   7. اختبارات سريعة (يمكن حذفها بعد التأكد)
   ============================================================== */
/*
-- مثال: تقارير من 1 يونيو حتى 30 يونيو
SELECT * FROM rpc_daily_reports_range('2025-06-01','2025-06-30') LIMIT 10;

-- ملخص Dashboard للفترة نفسها
SELECT * FROM rpc_dashboard_summary_range('2025-06-01','2025-06-30');

-- إحصائيات أسبوعية من 1 مايو حتى 31 يوليو
SELECT * FROM rpc_weekly_stats_range('2025-05-01','2025-07-31') LIMIT 6;

-- أداء الفرق بين 1 يناير و 31 مارس
SELECT * FROM rpc_team_performance_range('2025-01-01','2025-03-31') LIMIT 5;
*/