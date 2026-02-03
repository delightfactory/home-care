-- ===========================================
-- نظام تخزين إيصالات المصروفات - الإصدار المُصحّح
-- ===========================================
-- تاريخ المراجعة: 2026-02-03
-- 
-- ⚠️ تصحيح: استخدام role_id مع جدول roles بدلاً من u.role
-- ===========================================

-- =============================================
-- 1. حذف السياسات القديمة (إن وجدت)
-- =============================================

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "authenticated_users_can_upload_receipts" ON storage.objects;
    DROP POLICY IF EXISTS "public_can_read_receipts" ON storage.objects;
    DROP POLICY IF EXISTS "users_can_update_own_receipts" ON storage.objects;
    DROP POLICY IF EXISTS "admins_can_delete_receipts" ON storage.objects;
    DROP POLICY IF EXISTS "users_can_delete_own_receipts" ON storage.objects;
    DROP POLICY IF EXISTS "admins_can_update_receipts" ON storage.objects;
    DROP POLICY IF EXISTS "receipts_insert_authenticated" ON storage.objects;
    DROP POLICY IF EXISTS "receipts_select_public" ON storage.objects;
    DROP POLICY IF EXISTS "receipts_update_owner" ON storage.objects;
    DROP POLICY IF EXISTS "receipts_update_admin" ON storage.objects;
    DROP POLICY IF EXISTS "receipts_delete_owner" ON storage.objects;
    DROP POLICY IF EXISTS "receipts_delete_admin" ON storage.objects;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- =============================================
-- 2. دالة مساعدة للتحقق من صلاحية Admin/Supervisor
-- =============================================

CREATE OR REPLACE FUNCTION is_admin_or_supervisor()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
    AND r.name IN ('admin', 'supervisor')
  );
END;
$$;

-- =============================================
-- 3. سياسات RLS لـ Storage
-- =============================================

-- 3.1 سياسة الرفع (INSERT)
CREATE POLICY "receipts_insert_authenticated"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- 3.2 سياسة القراءة (SELECT)
CREATE POLICY "receipts_select_public"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'receipts');

-- 3.3 سياسة التحديث للمالك (UPDATE)
CREATE POLICY "receipts_update_owner"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'receipts' 
    AND (
        name LIKE (auth.uid()::text || '_%')
        OR name LIKE (auth.uid()::text || '/%')
    )
)
WITH CHECK (bucket_id = 'receipts');

-- 3.4 سياسة التحديث للمشرفين (UPDATE)
CREATE POLICY "receipts_update_admin"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'receipts'
    AND is_admin_or_supervisor()
)
WITH CHECK (bucket_id = 'receipts');

-- 3.5 سياسة الحذف للمالك (DELETE)
CREATE POLICY "receipts_delete_owner"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'receipts'
    AND (
        name LIKE (auth.uid()::text || '_%')
        OR name LIKE (auth.uid()::text || '/%')
    )
);

-- 3.6 سياسة الحذف للمشرفين (DELETE)
CREATE POLICY "receipts_delete_admin"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'receipts'
    AND is_admin_or_supervisor()
);

-- =============================================
-- 4. جدول تتبع حجم التخزين
-- =============================================

CREATE TABLE IF NOT EXISTS storage_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id TEXT NOT NULL UNIQUE,
    last_calculated_at TIMESTAMPTZ,
    last_cleanup_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE storage_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "storage_usage_select_authenticated" ON storage_usage;
CREATE POLICY "storage_usage_select_authenticated" 
ON storage_usage 
FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "storage_usage_update_admin" ON storage_usage;
CREATE POLICY "storage_usage_update_admin"
ON storage_usage 
FOR UPDATE 
TO authenticated
USING (is_admin_or_supervisor());

INSERT INTO storage_usage (bucket_id, notes)
VALUES ('receipts', 'Expense receipts storage bucket')
ON CONFLICT (bucket_id) DO NOTHING;

-- =============================================
-- 5. دوال مساعدة للإحصائيات والتنظيف
-- =============================================

CREATE OR REPLACE FUNCTION get_storage_stats(p_bucket_id TEXT DEFAULT 'receipts')
RETURNS TABLE (
    bucket_id TEXT,
    total_size_bytes BIGINT,
    total_size_mb NUMERIC,
    file_count BIGINT,
    oldest_file_date TIMESTAMPTZ,
    newest_file_date TIMESTAMPTZ,
    files_older_than_90_days BIGINT,
    max_allowed_mb INTEGER,
    usage_percentage NUMERIC,
    cleanup_recommended BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_max_mb INTEGER := 500;
BEGIN
    RETURN QUERY
    SELECT 
        p_bucket_id,
        COALESCE(SUM((o.metadata->>'size')::BIGINT), 0)::BIGINT,
        ROUND(COALESCE(SUM((o.metadata->>'size')::BIGINT), 0) / 1024.0 / 1024.0, 2),
        COUNT(*)::BIGINT,
        MIN(o.created_at),
        MAX(o.created_at),
        COUNT(*) FILTER (WHERE o.created_at < NOW() - INTERVAL '90 days')::BIGINT,
        v_max_mb,
        ROUND(
            (COALESCE(SUM((o.metadata->>'size')::BIGINT), 0) / 1024.0 / 1024.0 / v_max_mb) * 100, 
            2
        ),
        (COALESCE(SUM((o.metadata->>'size')::BIGINT), 0) / 1024.0 / 1024.0) > (v_max_mb * 0.8)
    FROM storage.objects o
    WHERE o.bucket_id = p_bucket_id;
    
    UPDATE storage_usage 
    SET last_calculated_at = NOW() 
    WHERE storage_usage.bucket_id = p_bucket_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_files_for_cleanup(
    p_bucket_id TEXT DEFAULT 'receipts',
    p_older_than_days INTEGER DEFAULT 90,
    p_max_files INTEGER DEFAULT 100
)
RETURNS TABLE (
    file_id UUID,
    file_name TEXT,
    file_path TEXT,
    file_size_bytes BIGINT,
    created_at TIMESTAMPTZ,
    age_days INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.name,
        p_bucket_id || '/' || o.name,
        (o.metadata->>'size')::BIGINT,
        o.created_at,
        EXTRACT(DAY FROM (NOW() - o.created_at))::INTEGER
    FROM storage.objects o
    WHERE o.bucket_id = p_bucket_id
        AND o.created_at < NOW() - (p_older_than_days || ' days')::INTERVAL
    ORDER BY o.created_at ASC
    LIMIT p_max_files;
END;
$$;

CREATE OR REPLACE FUNCTION log_cleanup_completed(
    p_bucket_id TEXT DEFAULT 'receipts',
    p_deleted_count INTEGER DEFAULT 0,
    p_freed_bytes BIGINT DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE storage_usage 
    SET 
        last_cleanup_at = NOW(),
        notes = 'Last cleanup: deleted ' || p_deleted_count || ' files, freed ' || 
                ROUND(p_freed_bytes / 1024.0 / 1024.0, 2) || ' MB'
    WHERE bucket_id = p_bucket_id;
END;
$$;




-- حذف الدالة القديمة وإعادة إنشائها
DROP FUNCTION IF EXISTS get_storage_stats(TEXT);

CREATE OR REPLACE FUNCTION get_storage_stats(p_bucket_id TEXT DEFAULT 'receipts')
RETURNS TABLE (
    bucket_id TEXT,
    total_size_bytes BIGINT,
    total_size_mb NUMERIC,
    file_count BIGINT,
    oldest_file_date TIMESTAMPTZ,
    newest_file_date TIMESTAMPTZ,
    files_older_than_90_days BIGINT,
    max_allowed_mb INTEGER,
    usage_percentage NUMERIC,
    cleanup_recommended BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_max_mb INTEGER := 500;
BEGIN
    RETURN QUERY
    SELECT 
        p_bucket_id,
        COALESCE(SUM((o.metadata->>'size')::BIGINT), 0)::BIGINT,
        ROUND(COALESCE(SUM((o.metadata->>'size')::BIGINT), 0) / 1024.0 / 1024.0, 2),
        COUNT(*)::BIGINT,
        MIN(o.created_at),
        MAX(o.created_at),
        COUNT(*) FILTER (WHERE o.created_at < NOW() - INTERVAL '90 days')::BIGINT,
        v_max_mb,
        ROUND(
            (COALESCE(SUM((o.metadata->>'size')::BIGINT), 0) / 1024.0 / 1024.0 / v_max_mb) * 100, 
            2
        ),
        (COALESCE(SUM((o.metadata->>'size')::BIGINT), 0) / 1024.0 / 1024.0) > (v_max_mb * 0.8)
    FROM storage.objects o
    WHERE o.bucket_id = get_storage_stats.p_bucket_id;
END;
$$;

-- منح الصلاحيات
GRANT EXECUTE ON FUNCTION get_storage_stats(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_storage_stats(TEXT) TO service_role;

-- اختبار الدالة
SELECT * FROM get_storage_stats('receipts');
-- =============================================
-- 6. صلاحيات الدوال
-- =============================================

GRANT EXECUTE ON FUNCTION is_admin_or_supervisor() TO authenticated;
GRANT EXECUTE ON FUNCTION get_storage_stats(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_files_for_cleanup(TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION log_cleanup_completed(TEXT, INTEGER, BIGINT) TO authenticated;

-- =============================================
-- 7. إعادة إنشاء سياسات Storage (قسم مستقل)
-- =============================================
-- ⚠️ هذا القسم يُنفّذ بشكل مستقل لضمان إنشاء السياسات
-- تاريخ التحديث: 2026-02-03

-- حذف السياسات القديمة أولاً
DROP POLICY IF EXISTS "receipts_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "receipts_select_public" ON storage.objects;
DROP POLICY IF EXISTS "receipts_update_owner" ON storage.objects;
DROP POLICY IF EXISTS "receipts_update_admin" ON storage.objects;
DROP POLICY IF EXISTS "receipts_delete_owner" ON storage.objects;
DROP POLICY IF EXISTS "receipts_delete_admin" ON storage.objects;

-- =============================================
-- سياسات الرفع والقراءة (أساسية)
-- =============================================

-- 1. سياسة الرفع - أي مستخدم مُسجّل يستطيع رفع إيصال
CREATE POLICY "receipts_insert_authenticated"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- 2. سياسة القراءة - الجميع يستطيع عرض الإيصالات
CREATE POLICY "receipts_select_public"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'receipts');

-- =============================================
-- سياسات التحديث
-- =============================================

-- 3. سياسة تحديث للمالك - المستخدم يستطيع تحديث ملفاته فقط
CREATE POLICY "receipts_update_owner"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'receipts' 
    AND (
        name LIKE (auth.uid()::text || '_%')
        OR name LIKE (auth.uid()::text || '/%')
    )
)
WITH CHECK (bucket_id = 'receipts');

-- 4. سياسة تحديث للمشرفين - Admin/Supervisor يستطيعون تحديث أي ملف
CREATE POLICY "receipts_update_admin"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'receipts'
    AND is_admin_or_supervisor()
)
WITH CHECK (bucket_id = 'receipts');

-- =============================================
-- سياسات الحذف
-- =============================================

-- 5. سياسة حذف للمالك - المستخدم يستطيع حذف ملفاته فقط
CREATE POLICY "receipts_delete_owner"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'receipts'
    AND (
        name LIKE (auth.uid()::text || '_%')
        OR name LIKE (auth.uid()::text || '/%')
    )
);

-- 6. سياسة حذف للمشرفين - Admin/Supervisor يستطيعون حذف أي ملف
CREATE POLICY "receipts_delete_admin"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'receipts'
    AND is_admin_or_supervisor()
);

-- =============================================
-- التحقق من إنشاء السياسات
-- =============================================
SELECT 
    policyname as "Policy Name",
    cmd as "Operation",
    CASE cmd 
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
    END as "Operation Type"
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE 'receipts%'
ORDER BY policyname;



-- =============================================
-- سياسة RLS للسماح للفني/القائد بقراءة route فريقه
-- =============================================

CREATE POLICY "routes_select_team_member"
ON routes
FOR SELECT
TO authenticated
USING (
    -- العامل عضو في الفريق (عبر team_members)
    EXISTS (
        SELECT 1 FROM team_members tm
        JOIN workers w ON w.id = tm.worker_id
        WHERE w.user_id = auth.uid()
        AND tm.team_id = routes.team_id
        AND tm.left_at IS NULL
    )
    -- أو قائد الفريق
    OR EXISTS (
        SELECT 1 FROM teams t
        JOIN workers w ON w.id = t.leader_id
        WHERE w.user_id = auth.uid()
        AND t.id = routes.team_id
    )
    -- أو لديه صلاحية قراءة routes (للإدارة)
    OR check_user_permission('routes', 'read')
);

-- التحقق
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'routes' AND policyname LIKE '%team%';