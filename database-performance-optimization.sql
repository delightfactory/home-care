-- =========================================================
-- Database Performance Optimization Script
-- نظام إدارة شركة التنظيف المنزلي - تحسين الأداء
-- =========================================================
-- تشغيل هذا السكريبت في Supabase SQL Editor
-- يجب تشغيله خلال ساعات الذروة المنخفضة

-- =========================================================
-- 1. إنشاء الفهارس الأساسية للأداء
-- =========================================================

-- فهارس جدول الطلبات (orders) - الأهم
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status_date 
ON orders(status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_customer_scheduled 
ON orders(customer_id, scheduled_date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_team_date 
ON orders(team_id, scheduled_date DESC) WHERE team_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_payment_status 
ON orders(payment_status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_scheduled_date 
ON orders(scheduled_date DESC);

-- فهرس مركب للبحث المتقدم في الطلبات
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_complex_search 
ON orders(status, payment_status, scheduled_date DESC);

-- فهارس جدول عناصر الطلبات (order_items)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id 
ON order_items(order_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_service_id 
ON order_items(service_id) WHERE service_id IS NOT NULL;

-- فهارس جدول العملاء (customers)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_active 
ON customers(is_active, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_area 
ON customers(area) WHERE area IS NOT NULL;

-- فهرس البحث النصي للعملاء (يدعم العربية)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_search_text 
ON customers USING GIN(to_tsvector('arabic', name || ' ' || COALESCE(phone, '')));

-- فهرس البحث السريع بالهاتف
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_phone 
ON customers(phone) WHERE phone IS NOT NULL;

-- فهارس جدول العمال (workers)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workers_status 
ON workers(status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workers_skills 
ON workers USING GIN(skills);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workers_rating 
ON workers(rating DESC) WHERE rating > 0;

-- فهارس جدول الفرق (teams)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teams_active 
ON teams(is_active, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teams_leader 
ON teams(leader_id) WHERE leader_id IS NOT NULL;

-- فهارس جدول أعضاء الفرق (team_members)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_members_team 
ON team_members(team_id, joined_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_members_worker 
ON team_members(worker_id);

-- فهارس جدول المصروفات (expenses)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_date_team 
ON expenses(created_at DESC, team_id) WHERE team_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_order 
ON expenses(order_id) WHERE order_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_status 
ON expenses(status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_approval 
ON expenses(status, approved_at DESC) WHERE status IN ('pending', 'approved');

-- فهارس جدول خطوط السير (routes)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_routes_date_team 
ON routes(date DESC, team_id) WHERE team_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_routes_status 
ON routes(status, date DESC);

-- فهارس جدول طلبات خطوط السير (route_orders)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_route_orders_route 
ON route_orders(route_id, sequence_order);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_route_orders_order 
ON route_orders(order_id);

-- فهارس جدول سجل حالة الطلبات (order_status_logs)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_status_logs_order 
ON order_status_logs(order_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_status_logs_status 
ON order_status_logs(status, created_at DESC);

-- فهارس جدول الخدمات (services)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_category 
ON services(category_id, is_active) WHERE category_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_active 
ON services(is_active, created_at DESC);

-- =========================================================
-- 2. إنشاء Views محسنة للتقارير
-- =========================================================

-- View للطلبات مع التفاصيل الأساسية (بدون JOIN معقدة)
CREATE OR REPLACE VIEW v_orders_summary AS
SELECT 
    o.id,
    o.order_number,
    o.customer_id,
    c.name as customer_name,
    c.phone as customer_phone,
    o.team_id,
    t.name as team_name,
    o.scheduled_date,
    o.scheduled_time,
    o.status,
    o.payment_status,
    o.total_amount,
    o.transport_cost,
    o.customer_rating,
    o.created_at,
    o.updated_at
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.id
LEFT JOIN teams t ON o.team_id = t.id;

-- فهرس للـ View
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_v_orders_summary_status_date 
ON orders(status, scheduled_date DESC);

-- View للإحصائيات اليومية المحسنة
CREATE OR REPLACE VIEW v_daily_stats AS
SELECT 
    DATE(scheduled_date) as report_date,
    COUNT(*) as total_orders,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_orders,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_orders,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_orders,
    SUM(total_amount) FILTER (WHERE status = 'completed') as total_revenue,
    AVG(customer_rating) FILTER (WHERE customer_rating IS NOT NULL) as avg_rating,
    COUNT(DISTINCT team_id) FILTER (WHERE team_id IS NOT NULL) as active_teams
FROM orders 
WHERE scheduled_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(scheduled_date)
ORDER BY report_date DESC;

-- View لأداء الفرق المحسن
CREATE OR REPLACE VIEW v_team_performance AS
SELECT 
    t.id as team_id,
    t.name as team_name,
    t.leader_id,
    w.name as leader_name,
    COUNT(o.id) as total_orders,
    COUNT(o.id) FILTER (WHERE o.status = 'completed') as completed_orders,
    SUM(o.total_amount) FILTER (WHERE o.status = 'completed') as total_revenue,
    AVG(o.customer_rating) FILTER (WHERE o.customer_rating IS NOT NULL) as avg_rating,
    COUNT(DISTINCT DATE(o.scheduled_date)) as active_days
FROM teams t
LEFT JOIN workers w ON t.leader_id = w.id
LEFT JOIN orders o ON t.id = o.team_id AND o.scheduled_date >= CURRENT_DATE - INTERVAL '30 days'
WHERE t.is_active = true
GROUP BY t.id, t.name, t.leader_id, w.name
ORDER BY completed_orders DESC;

-- =========================================================
-- 3. إنشاء Materialized Views للتقارير الثقيلة
-- =========================================================

-- Materialized View للإحصائيات الشهرية
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_monthly_stats AS
SELECT 
    DATE_TRUNC('month', scheduled_date) as month_date,
    COUNT(*) as total_orders,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_orders,
    SUM(total_amount) FILTER (WHERE status = 'completed') as total_revenue,
    COUNT(DISTINCT customer_id) as unique_customers,
    COUNT(DISTINCT team_id) FILTER (WHERE team_id IS NOT NULL) as active_teams,
    AVG(customer_rating) FILTER (WHERE customer_rating IS NOT NULL) as avg_rating
FROM orders 
WHERE scheduled_date >= CURRENT_DATE - INTERVAL '2 years'
GROUP BY DATE_TRUNC('month', scheduled_date)
ORDER BY month_date DESC;

-- فهرس للـ Materialized View
CREATE INDEX IF NOT EXISTS idx_mv_monthly_stats_month 
ON mv_monthly_stats(month_date DESC);

-- Materialized View لأفضل العملاء
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_customers AS
SELECT 
    c.id,
    c.name,
    c.phone,
    c.area,
    COUNT(o.id) as total_orders,
    COUNT(o.id) FILTER (WHERE o.status = 'completed') as completed_orders,
    SUM(o.total_amount) FILTER (WHERE o.status = 'completed') as total_spent,
    AVG(o.customer_rating) FILTER (WHERE o.customer_rating IS NOT NULL) as avg_rating,
    MAX(o.scheduled_date) as last_order_date
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
WHERE c.is_active = true
GROUP BY c.id, c.name, c.phone, c.area
HAVING COUNT(o.id) > 0
ORDER BY total_spent DESC, completed_orders DESC;

-- فهرس للـ Materialized View
CREATE INDEX IF NOT EXISTS idx_mv_top_customers_spent 
ON mv_top_customers(total_spent DESC);

-- =========================================================
-- 4. Functions لتحديث Materialized Views
-- =========================================================

-- Function لتحديث الإحصائيات الشهرية
CREATE OR REPLACE FUNCTION refresh_monthly_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_stats;
END;
$$ LANGUAGE plpgsql;

-- Function لتحديث أفضل العملاء
CREATE OR REPLACE FUNCTION refresh_top_customers()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_customers;
END;
$$ LANGUAGE plpgsql;

-- Function لتحديث جميع الـ Views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
    PERFORM refresh_monthly_stats();
    PERFORM refresh_top_customers();
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- 5. تحسين إعدادات PostgreSQL (اختيارية)
-- =========================================================

-- زيادة shared_buffers (يتطلب إعادة تشغيل)
-- ALTER SYSTEM SET shared_buffers = '256MB';

-- تحسين work_mem للاستعلامات المعقدة
-- ALTER SYSTEM SET work_mem = '16MB';

-- تحسين effective_cache_size
-- ALTER SYSTEM SET effective_cache_size = '1GB';

-- تفعيل الإحصائيات المتقدمة
ALTER SYSTEM SET track_activities = on;
ALTER SYSTEM SET track_counts = on;
ALTER SYSTEM SET track_io_timing = on;

-- =========================================================
-- 6. إنشاء جدول لمراقبة الأداء
-- =========================================================

CREATE TABLE IF NOT EXISTS performance_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    query_type VARCHAR(50) NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    query_hash VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- فهرس لجدول مراقبة الأداء
CREATE INDEX IF NOT EXISTS idx_performance_logs_type_time 
ON performance_logs(query_type, execution_time_ms DESC, created_at DESC);

-- =========================================================
-- 7. Function لتنظيف البيانات القديمة
-- =========================================================

CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- حذف سجلات الأداء الأقدم من 30 يوم
    DELETE FROM performance_logs 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- حذف سجلات حالة الطلبات الأقدم من سنة
    DELETE FROM order_status_logs 
    WHERE created_at < NOW() - INTERVAL '1 year';
    
    -- تحديث إحصائيات الجداول
    ANALYZE orders;
    ANALYZE customers;
    ANALYZE workers;
    ANALYZE teams;
    ANALYZE expenses;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- 8. إنشاء Triggers للتحديث التلقائي
-- =========================================================

-- Trigger لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- تطبيق الـ Trigger على الجداول المطلوبة
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workers_updated_at ON workers;
CREATE TRIGGER update_workers_updated_at
    BEFORE UPDATE ON workers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- 9. إعداد مهام التنظيف التلقائية (pg_cron)
-- =========================================================

-- تحديث Materialized Views يومياً في الساعة 2 صباحاً
-- SELECT cron.schedule('refresh-views', '0 2 * * *', 'SELECT refresh_all_materialized_views();');

-- تنظيف البيانات القديمة أسبوعياً
-- SELECT cron.schedule('cleanup-old-data', '0 3 * * 0', 'SELECT cleanup_old_data();');

-- =========================================================
-- 10. تحليل الجداول لتحديث الإحصائيات
-- =========================================================

ANALYZE customers;
ANALYZE orders;
ANALYZE order_items;
ANALYZE workers;
ANALYZE teams;
ANALYZE team_members;
ANALYZE expenses;
ANALYZE routes;
ANALYZE route_orders;
ANALYZE services;
ANALYZE order_status_logs;

-- =========================================================
-- تم الانتهاء من سكريبت التحسين
-- =========================================================

-- رسالة تأكيد
DO $$
BEGIN
    RAISE NOTICE 'Database optimization script completed successfully!';
    RAISE NOTICE 'Created % indexes for improved performance', 
        (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%');
    RAISE NOTICE 'Next steps: Monitor query performance and adjust as needed';
END $$;
