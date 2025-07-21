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