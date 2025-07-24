-- =========================================================
-- Database Views & Indexes for Home-Cleaning Management App
-- =========================================================
-- هذا الملف يحتوي على فهارس إضافية و Views جاهزة للتقارير
-- شغِّله مرة واحدة في لوحة SQL داخل Supabase.

-- ---------------------------------------------------------
-- 1. فهارس إضافية لتحسين الأداء
-- ---------------------------------------------------------

-- عمال حسب الحالة (active / inactive / vacation)
CREATE INDEX IF NOT EXISTS idx_workers_status ON workers(status);

-- البحث السريع عن العمال داخل الفرق
CREATE INDEX IF NOT EXISTS idx_team_members_worker ON team_members(worker_id);

-- البحث السريع عن الطلبات حسب الفريق
CREATE INDEX IF NOT EXISTS idx_orders_team ON orders(team_id);

-- ---------------------------------------------------------
-- 2. View: v_daily_dashboard
--    ملخص سريع لليوم (يمكن تعديل WHERE لتمرير تاريخ محدد)
-- ---------------------------------------------------------
CREATE OR REPLACE VIEW v_daily_dashboard AS
SELECT
  dr.report_date                               AS report_date,
  dr.total_orders,
  dr.completed_orders,
  dr.cancelled_orders,
  dr.total_revenue,
  dr.total_expenses,
  dr.net_profit,
  dr.active_teams,
  dr.average_rating
FROM daily_reports dr
ORDER BY dr.report_date DESC;

-- ---------------------------------------------------------
-- 3. View: v_team_summary
--    يعرض أداء كل فريق عبر كامل الفترة المتوفرة
-- ---------------------------------------------------------
CREATE OR REPLACE VIEW v_team_summary AS
SELECT
  t.id                                  AS team_id,
  t.name                                AS team_name,
  COALESCE(SUM(tp.orders_completed),0)  AS orders_completed,
  COALESCE(SUM(tp.total_revenue),0)     AS total_revenue,
  COALESCE(SUM(tp.total_expenses),0)    AS total_expenses,
  COALESCE(AVG(tp.average_rating),0)    AS average_rating,
  COALESCE(AVG(tp.efficiency_score),0)  AS efficiency_score
FROM teams t
LEFT JOIN team_performance tp ON tp.team_id = t.id
WHERE t.is_active
GROUP BY t.id, t.name
ORDER BY orders_completed DESC;

-- ---------------------------------------------------------
-- 4. View: v_customer_history
--    آخر طلب وتقييم لكل عميل مع إجمالي الطلبات
-- ---------------------------------------------------------
CREATE OR REPLACE VIEW v_customer_history AS
SELECT
  c.id,
  c.name,
  c.phone,
  c.area,
  COUNT(o.id)                   AS total_orders,
  MAX(o.scheduled_date)         AS last_order_date,
  AVG(o.customer_rating)        AS avg_rating
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id;

-- ---------------------------------------------------------
-- 5. View: v_worker_stats
--    إحصائيات مجمعة للعامل اعتماداً على جدول team_performance و orders
-- ---------------------------------------------------------
CREATE OR REPLACE VIEW v_worker_stats AS
SELECT
  w.id                               AS worker_id,
  w.name                             AS worker_name,
  w.status,
  w.rating,
  w.total_orders,
  COUNT(o.id) FILTER (WHERE o.status = 'completed') AS completed_orders,
  AVG(o.customer_rating)                           AS average_rating
FROM workers w
LEFT JOIN team_members tm ON tm.worker_id = w.id
LEFT JOIN orders o        ON o.team_id = tm.team_id
GROUP BY w.id;

-- ---------------------------------------------------------
-- 6. منح الصلاحية على الـViews للأدوار المصادق عليها
-- ---------------------------------------------------------
GRANT SELECT ON v_daily_dashboard, v_team_summary, v_customer_history, v_worker_stats TO authenticated, anon;



-- أعِد منح الصلاحية بعد كل CREATE OR REPLACE
GRANT SELECT ON v_daily_dashboard,
              v_team_summary,
              v_customer_history,
              v_worker_stats
TO authenticated, anon;

-- وقائياً: اجعل منح الصلاحيات تلقائياً لأى View جديدة لاحقاً
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO authenticated, anon;




  /* =========================================================
   سكريبت التقارير المتقدمة –  Home-Care Analytics
   =========================================================
   - mv_weekly_stats   : ملخص أسبوعي يبدأ بالسبت
   - mv_quarterly_stats: ملخص ربع سنوي
   - دوال التحديث       : refresh_weekly_stats(), refresh_quarterly_stats()
   - جدولة مبدئية       : يمكن ضبطها من Supabase Scheduled Tasks
   --------------------------------------------------------- */

/* ---------- 1. دالة ألماني لحساب بداية الأسبوع (السبت) ---------- */
CREATE OR REPLACE FUNCTION get_week_start_eg(p_date date)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  /* نحرك التاريخ +1 يوم للحصول على أسبوع يبدأ الأحد (افتراضي PG)،
     ثم نطرح يوم واحد فنعود إلى السبت */
  SELECT date_trunc('week', p_date + INTERVAL '1 day')::date - INTERVAL '1 day';
$$;

/* ========= 2. المادّة فيو: mv_weekly_stats ========= */
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_weekly_stats AS
SELECT
  get_week_start_eg(dr.report_date)      AS week_start,          -- بداية الأسبوع (سبت)
  COUNT(*)                               AS total_days_covered,  -- عدد الأيام المضمنة
  SUM(dr.total_orders)                   AS total_orders,
  SUM(dr.completed_orders)               AS completed_orders,
  SUM(dr.cancelled_orders)               AS cancelled_orders,
  SUM(dr.total_revenue)                  AS total_revenue,
  SUM(dr.total_expenses)                 AS total_expenses,
  SUM(dr.net_profit)                     AS net_profit,
  AVG(dr.average_rating)                 AS avg_rating
FROM daily_reports dr
GROUP BY week_start
ORDER BY week_start DESC;

/* فهارس لتحسين الاستعلام حسب التاريخ */
CREATE INDEX IF NOT EXISTS idx_mv_weekly_stats_start ON mv_weekly_stats (week_start);

/* ========= 3. المادّة فيو: mv_quarterly_stats ========= */
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_quarterly_stats AS
SELECT
  date_trunc('quarter', dr.report_date)::date          AS quarter_start,  -- أول يوم فى الربع
  COUNT(*)                                             AS total_days_covered,
  SUM(dr.total_orders)                                 AS total_orders,
  SUM(dr.completed_orders)                             AS completed_orders,
  SUM(dr.cancelled_orders)                             AS cancelled_orders,
  SUM(dr.total_revenue)                                AS total_revenue,
  SUM(dr.total_expenses)                               AS total_expenses,
  SUM(dr.net_profit)                                   AS net_profit,
  AVG(dr.average_rating)                               AS avg_rating
FROM daily_reports dr
GROUP BY quarter_start
ORDER BY quarter_start DESC;

CREATE INDEX IF NOT EXISTS idx_mv_quarterly_stats_start ON mv_quarterly_stats (quarter_start);

/* ---------- 4. دوال التحديث (Concurrently لتجنّب القفل) ---------- */
CREATE OR REPLACE FUNCTION refresh_weekly_stats() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_weekly_stats;
END;
$$;

CREATE OR REPLACE FUNCTION refresh_quarterly_stats() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_quarterly_stats;
END;
$$;

/* ---------- 5. منح الصلاحيات لأدوار الواجهة ---------- */
GRANT SELECT ON mv_weekly_stats,
               mv_quarterly_stats
TO authenticated, anon;

/* ---------- 6. ملاحظات الجدولة ---------- */
/*
  - لتحديث mv_weekly_stats:
      يُفضّل جدول كرون كل يوم سبت 03:00 صباحًا
      مثال Supabase (cron):
        schedule '0 3 * * 6' refresh_weekly_stats();
  - لتحديث mv_quarterly_stats:
      أول يوم في كل ربع 03:15 صباحًا
        schedule '15 3 1 1,4,7,10 *' refresh_quarterly_stats();
  - يمكن أيضًا استدعاء الدوال يدويًا عند اللزوم:
        SELECT refresh_weekly_stats();
        SELECT refresh_quarterly_stats();
*/

/* ---------- 7. اختبارات سريعة ---------- */
/* تحقق من أن الأسبوع يبدأ سبت */
-- SELECT get_week_start_eg('2025-07-24');  -- يُرجع 2025-07-19 (سبت)

/* معاينة أول 5 أسابيع */
-- SELECT * FROM mv_weekly_stats ORDER BY week_start DESC LIMIT 5;

/* معاينة آخر 4 أرباع */
-- SELECT * FROM mv_quarterly_stats ORDER BY quarter_start DESC LIMIT 4;