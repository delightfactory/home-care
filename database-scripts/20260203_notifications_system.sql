-- ===================================
-- نظام الإشعارات - Migration Script
-- آمن للتشغيل عدة مرات
-- Created: 2026-02-03
-- ===================================

BEGIN;

-- تأكد من وجود pgcrypto
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. جدول الإشعارات الرئيسي
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- نوع وتصنيف الإشعار
    type VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    
    -- المحتوى
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- الربط بالكيانات الأخرى
    reference_type VARCHAR(50),
    reference_id UUID,
    action_url TEXT,
    
    -- البيانات الإضافية (للتوسع)
    metadata JSONB DEFAULT '{}',
    
    -- حالة القراءة
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    
    -- الطوابع الزمنية
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    -- قيود
    CONSTRAINT valid_reference CHECK (
        (reference_type IS NULL AND reference_id IS NULL) OR
        (reference_type IS NOT NULL AND reference_id IS NOT NULL)
    )
);

COMMENT ON TABLE notifications IS 'جدول الإشعارات الرئيسي لجميع المستخدمين';
COMMENT ON COLUMN notifications.type IS 'نوع الإشعار: order_created, expense_approved, route_assigned, etc.';
COMMENT ON COLUMN notifications.category IS 'الفئة: orders, expenses, routes, teams, customers, system';

-- ============================================
-- 2. جدول تفضيلات الإشعارات
-- ============================================
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    
    -- التفعيل العام
    in_app_enabled BOOLEAN DEFAULT true,
    push_enabled BOOLEAN DEFAULT true,
    
    -- تفضيلات الفئات
    categories JSONB DEFAULT '{
        "orders": true,
        "expenses": true,
        "routes": true,
        "teams": true,
        "customers": true,
        "system": true
    }',
    
    -- ساعات الهدوء (لا إشعارات push)
    quiet_hours_enabled BOOLEAN DEFAULT false,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    
    -- الطوابع الزمنية
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE notification_preferences IS 'تفضيلات الإشعارات لكل مستخدم';

-- ============================================
-- 3. جدول اشتراكات Push
-- ============================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- بيانات الاشتراك (Web Push API)
    endpoint TEXT NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    
    -- معلومات الجهاز
    device_name VARCHAR(100),
    device_type VARCHAR(50), -- mobile, desktop, tablet
    browser VARCHAR(50),
    user_agent TEXT,
    
    -- الحالة
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    failed_count INTEGER DEFAULT 0,
    
    -- الطوابع الزمنية
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- قيد فريد
    UNIQUE(user_id, endpoint)
);

COMMENT ON TABLE push_subscriptions IS 'اشتراكات Push Notifications لأجهزة المستخدمين';

-- ============================================
-- 4. الفهارس للأداء
-- ============================================
CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
    ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
    ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_category 
    ON notifications(category);
CREATE INDEX IF NOT EXISTS idx_notifications_type 
    ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_reference 
    ON notifications(reference_type, reference_id) 
    WHERE reference_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id 
    ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active 
    ON push_subscriptions(user_id, is_active) WHERE is_active = true;

-- ============================================
-- 5. تفعيل RLS
-- ============================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. سياسات RLS - notifications
-- ============================================
DROP POLICY IF EXISTS "notifications_select" ON notifications;
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
DROP POLICY IF EXISTS "notifications_update" ON notifications;
DROP POLICY IF EXISTS "notifications_delete" ON notifications;

-- المستخدم يرى إشعاراته فقط
CREATE POLICY "notifications_select" ON notifications
    FOR SELECT USING (user_id = auth.uid());

-- service_role فقط يمكنه الإدراج (عبر functions)
CREATE POLICY "notifications_insert" ON notifications
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- المستخدم يمكنه تحديث إشعاراته (للقراءة)
CREATE POLICY "notifications_update" ON notifications
    FOR UPDATE USING (user_id = auth.uid());

-- المستخدم يمكنه حذف إشعاراته
CREATE POLICY "notifications_delete" ON notifications
    FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- 7. سياسات RLS - notification_preferences
-- ============================================
DROP POLICY IF EXISTS "notification_preferences_select" ON notification_preferences;
DROP POLICY IF EXISTS "notification_preferences_insert" ON notification_preferences;
DROP POLICY IF EXISTS "notification_preferences_update" ON notification_preferences;

CREATE POLICY "notification_preferences_select" ON notification_preferences
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notification_preferences_insert" ON notification_preferences
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "notification_preferences_update" ON notification_preferences
    FOR UPDATE USING (user_id = auth.uid());

-- ============================================
-- 8. سياسات RLS - push_subscriptions
-- ============================================
DROP POLICY IF EXISTS "push_subscriptions_select" ON push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_insert" ON push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_update" ON push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_delete" ON push_subscriptions;

CREATE POLICY "push_subscriptions_select" ON push_subscriptions
    FOR SELECT USING (user_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "push_subscriptions_insert" ON push_subscriptions
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_subscriptions_update" ON push_subscriptions
    FOR UPDATE USING (user_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "push_subscriptions_delete" ON push_subscriptions
    FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- 9. منح الصلاحيات
-- ============================================
GRANT SELECT, UPDATE, DELETE ON notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON notification_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO authenticated;
GRANT ALL ON notifications, notification_preferences, push_subscriptions TO service_role;

-- ============================================
-- 10. دالة إنشاء إشعار
-- ============================================
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_type VARCHAR(50),
    p_category VARCHAR(50),
    p_title VARCHAR(255),
    p_message TEXT,
    p_priority VARCHAR(20) DEFAULT 'medium',
    p_reference_type VARCHAR(50) DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_action_url TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_notification_id UUID;
    v_prefs notification_preferences;
BEGIN
    -- التحقق من تفضيلات المستخدم
    SELECT * INTO v_prefs
    FROM notification_preferences
    WHERE user_id = p_user_id;
    
    -- إذا لم توجد تفضيلات، أنشئها بالقيم الافتراضية
    IF NOT FOUND THEN
        INSERT INTO notification_preferences (user_id)
        VALUES (p_user_id)
        RETURNING * INTO v_prefs;
    END IF;
    
    -- تحقق هل الفئة مفعلة
    IF NOT v_prefs.in_app_enabled THEN
        RETURN NULL;
    END IF;
    
    IF NOT COALESCE((v_prefs.categories->>p_category)::boolean, true) THEN
        RETURN NULL;
    END IF;
    
    -- إدراج الإشعار
    INSERT INTO notifications (
        user_id, type, category, title, message,
        priority, reference_type, reference_id, action_url, metadata
    ) VALUES (
        p_user_id, p_type, p_category, p_title, p_message,
        p_priority, p_reference_type, p_reference_id, p_action_url, p_metadata
    )
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$;

COMMENT ON FUNCTION create_notification IS 'إنشاء إشعار جديد مع مراعاة تفضيلات المستخدم';

-- ============================================
-- 11. دالة إرسال إشعار لمجموعة مستخدمين بدور معين
-- ============================================
CREATE OR REPLACE FUNCTION notify_users_by_role(
    p_role_name VARCHAR(50),
    p_type VARCHAR(50),
    p_category VARCHAR(50),
    p_title VARCHAR(255),
    p_message TEXT,
    p_priority VARCHAR(20) DEFAULT 'medium',
    p_reference_type VARCHAR(50) DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_action_url TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_record RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_user_record IN 
        SELECT u.id
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE r.name = p_role_name
        AND u.is_active = true
    LOOP
        PERFORM create_notification(
            v_user_record.id,
            p_type, p_category, p_title, p_message,
            p_priority, p_reference_type, p_reference_id, p_action_url
        );
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION notify_users_by_role IS 'إرسال إشعار لجميع المستخدمين بدور معين';

-- ============================================
-- 12. دالة الحصول على عدد الإشعارات غير المقروءة
-- ============================================
CREATE OR REPLACE FUNCTION get_unread_notifications_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM notifications
    WHERE user_id = p_user_id
    AND is_read = false
    AND (expires_at IS NULL OR expires_at > NOW());
    
    RETURN v_count;
END;
$$;

-- ============================================
-- 13. دالة تحديث الإشعار كمقروء
-- ============================================
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE notifications
    SET is_read = true, read_at = NOW()
    WHERE id = p_notification_id
    AND user_id = auth.uid();
    
    RETURN FOUND;
END;
$$;

-- ============================================
-- 14. دالة تحديث كل الإشعارات كمقروءة
-- ============================================
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE notifications
    SET is_read = true, read_at = NOW()
    WHERE user_id = auth.uid()
    AND is_read = false;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ============================================
-- 15. دالة التنظيف التلقائي للإشعارات المنتهية
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM notifications
    WHERE expires_at IS NOT NULL
    AND expires_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ============================================
-- 16. منح صلاحيات تنفيذ الدوال
-- ============================================
GRANT EXECUTE ON FUNCTION create_notification TO service_role;
GRANT EXECUTE ON FUNCTION notify_users_by_role TO service_role;
GRANT EXECUTE ON FUNCTION get_unread_notifications_count TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_read TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_notifications TO service_role;

-- ============================================
-- 17. تفعيل Realtime للإشعارات
-- ============================================
DO $$
BEGIN
    -- Check if table is already in publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    END IF;
END $$;

COMMIT;
