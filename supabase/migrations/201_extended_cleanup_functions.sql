-- ===========================================
-- Migration: Extended Storage Cleanup Functions
-- توسيع دوال التنظيف لدعم buckets متعددة
-- ===========================================
-- 
-- ⚠️ ملاحظة هامة:
-- هذه الدوال مُصممة للعمل مع cleanup-storage الجديدة
-- ولا تُعدّل على الدوال الأصلية المستخدمة في cleanup-receipts
-- ===========================================

-- دالة جديدة للحصول على إحصائيات التخزين مع عتبة عمر مخصصة
-- ⚠️ اسم مختلف عن get_storage_stats الأصلية لتجنب التعارض
CREATE OR REPLACE FUNCTION get_storage_stats_for_bucket(
    p_bucket_id TEXT,
    p_age_threshold_days INT
)
RETURNS TABLE (
    total_size_mb NUMERIC,
    file_count BIGINT,
    files_older_than_threshold BIGINT,
    usage_percentage NUMERIC,
    cleanup_recommended BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(s.metadata->>'size')::NUMERIC / 1024 / 1024, 0) as total_size_mb,
        COUNT(*) as file_count,
        COUNT(*) FILTER (
            WHERE s.created_at < now() - (p_age_threshold_days || ' days')::INTERVAL
        ) as files_older_than_threshold,
        CASE 
            WHEN 500 > 0 THEN COALESCE(SUM(s.metadata->>'size')::NUMERIC / 1024 / 1024 / 500 * 100, 0)
            ELSE 0
        END as usage_percentage,
        COALESCE(SUM(s.metadata->>'size')::NUMERIC / 1024 / 1024 / 500 * 100, 0) > 80 as cleanup_recommended
    FROM storage.objects s
    WHERE s.bucket_id = p_bucket_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة جديدة للحصول على الملفات للتنظيف مع اسم مختلف
-- ⚠️ اسم جديد لتجنب تعديل الدالة الأصلية get_files_for_cleanup
CREATE OR REPLACE FUNCTION get_files_for_multi_bucket_cleanup(
    p_bucket_id TEXT,
    p_older_than_days INT,
    p_max_files INT
)
RETURNS TABLE (
    file_id UUID,
    file_name TEXT,
    file_size_bytes BIGINT,
    age_days INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id as file_id,
        s.name as file_name,
        COALESCE((s.metadata->>'size')::BIGINT, 0) as file_size_bytes,
        EXTRACT(DAY FROM (now() - s.created_at))::INT as age_days
    FROM storage.objects s
    WHERE s.bucket_id = p_bucket_id
      AND s.created_at < now() - (p_older_than_days || ' days')::INTERVAL
    ORDER BY s.created_at ASC
    LIMIT p_max_files;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- منح الصلاحيات
GRANT EXECUTE ON FUNCTION get_storage_stats_for_bucket(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_storage_stats_for_bucket(TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION get_files_for_multi_bucket_cleanup(TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_files_for_multi_bucket_cleanup(TEXT, INT, INT) TO service_role;
