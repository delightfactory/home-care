-- =============================================================================
-- نظام الرسائل الداخلية - Internal Messaging System
-- تاريخ: 2026-02-03
-- الوصف: نظام تواصل داخلي مستوحى من WhatsApp
-- =============================================================================

-- تفعيل UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. جدول المحادثات (conversations)
-- =============================================================================

CREATE TABLE IF NOT EXISTS conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- نوع المحادثة
    type VARCHAR(20) NOT NULL CHECK (type IN ('direct', 'team', 'group', 'broadcast')),
    -- direct: محادثة بين شخصين
    -- team: محادثة فريق (كل أعضاء الفريق)
    -- group: مجموعة مخصصة
    -- broadcast: إعلان من المدير
    
    -- معلومات المحادثة
    title VARCHAR(100), -- اسم المجموعة/المحادثة (للنوع group و broadcast)
    description TEXT, -- وصف المجموعة
    avatar_url TEXT, -- صورة المجموعة
    
    -- ربط بالفريق (للنوع team)
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    
    -- الإعلانات المستهدفة (للنوع broadcast)
    target_role VARCHAR(50), -- استهداف دور معين
    target_all BOOLEAN DEFAULT false, -- استهداف الجميع
    
    -- المنشئ
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- آخر رسالة (للترتيب السريع)
    last_message_id UUID,
    last_message_at TIMESTAMPTZ,
    last_message_preview TEXT, -- أول 100 حرف من آخر رسالة
    
    -- الحالة
    is_active BOOLEAN DEFAULT true,
    is_pinned BOOLEAN DEFAULT false, -- تثبيت المحادثة
    
    -- الطوابع الزمنية
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);
CREATE INDEX IF NOT EXISTS idx_conversations_team ON conversations(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON conversations(created_by);

COMMENT ON TABLE conversations IS 'المحادثات - الدردشات الفردية والجماعية';

-- =============================================================================
-- 2. جدول المشاركين في المحادثة (conversation_participants)
-- =============================================================================

CREATE TABLE IF NOT EXISTS conversation_participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- ربط المحادثة والمستخدم
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- الدور في المحادثة
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    
    -- حالة القراءة
    last_read_at TIMESTAMPTZ, -- آخر وقت قراءة
    last_read_message_id UUID, -- آخر رسالة تمت قراءتها
    unread_count INTEGER DEFAULT 0, -- عدد الرسائل غير المقروءة
    
    -- إعدادات الإشعارات
    is_muted BOOLEAN DEFAULT false, -- كتم الإشعارات
    muted_until TIMESTAMPTZ, -- كتم حتى تاريخ معين
    
    -- الحالة
    is_active BOOLEAN DEFAULT true, -- هل المستخدم ما زال في المحادثة
    left_at TIMESTAMPTZ, -- تاريخ المغادرة (للأرشيف)
    
    -- الطوابع الزمنية
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- قيد فريد
    UNIQUE(conversation_id, user_id)
);

-- فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_participants_user ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_participants_unread ON conversation_participants(user_id, unread_count) 
    WHERE unread_count > 0;
CREATE INDEX IF NOT EXISTS idx_participants_active ON conversation_participants(user_id, is_active) 
    WHERE is_active = true;

COMMENT ON TABLE conversation_participants IS 'المشاركون في المحادثات مع حالة القراءة';

-- =============================================================================
-- 3. جدول الرسائل (messages)
-- =============================================================================

CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- ربط المحادثة والمرسل
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- محتوى الرسالة
    content TEXT, -- نص الرسالة
    content_type VARCHAR(20) DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'file', 'system', 'voice')),
    
    -- المرفقات
    attachment_url TEXT, -- رابط الملف
    attachment_name VARCHAR(255), -- اسم الملف الأصلي
    attachment_size INTEGER, -- حجم الملف بالبايت
    attachment_mime_type VARCHAR(100), -- نوع الملف
    
    -- الرد على رسالة (Reply)
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    
    -- رسائل النظام (مثل "انضم X للمجموعة")
    is_system BOOLEAN DEFAULT false,
    system_action VARCHAR(50), -- joined, left, renamed, created, etc.
    
    -- حالة الرسالة
    is_edited BOOLEAN DEFAULT false,
    edited_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT false, -- حذف ناعم
    deleted_at TIMESTAMPTZ,
    deleted_for_everyone BOOLEAN DEFAULT false,
    
    -- الطوابع الزمنية
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- فهارس للأداء (مهم جداً للسرعة)
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_reply ON messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

COMMENT ON TABLE messages IS 'الرسائل - محتوى المحادثات';

-- =============================================================================
-- 4. جدول حالات القراءة (message_read_receipts) - اختياري للتفاصيل
-- =============================================================================

CREATE TABLE IF NOT EXISTS message_read_receipts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_receipts_message ON message_read_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_receipts_user ON message_read_receipts(user_id);

COMMENT ON TABLE message_read_receipts IS 'تفاصيل قراءة الرسائل لكل مستخدم';

-- =============================================================================
-- 5. تفعيل RLS
-- =============================================================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_read_receipts ENABLE ROW LEVEL SECURITY;

-- تفعيل REPLICA IDENTITY FULL للـ Real-time subscriptions
-- مطلوب لـ Supabase Realtime للعمل مع الفلاتر على مستوى الصف
ALTER TABLE conversations REPLICA IDENTITY FULL;
ALTER TABLE conversation_participants REPLICA IDENTITY FULL;
ALTER TABLE messages REPLICA IDENTITY FULL;

-- =============================================================================
-- 5.1 دوال مساعدة للتحقق (خاصة بنظام الرسائل - لتجنب التعارض مع دوال أخرى)
-- =============================================================================

CREATE OR REPLACE FUNCTION messaging_is_participant(p_conversation_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM conversation_participants
        WHERE conversation_id = p_conversation_id
        AND user_id = p_user_id
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- دالة للتحقق من كون المستخدم مديراً (خاصة بنظام الرسائل)
CREATE OR REPLACE FUNCTION messaging_messaging_is_manager(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users u 
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = p_user_id 
        AND r.name = 'manager'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION messaging_is_participant TO authenticated;
GRANT EXECUTE ON FUNCTION messaging_is_manager TO authenticated;

-- =============================================================================
-- 6. سياسات RLS - conversations
-- =============================================================================

-- المستخدم يرى المحادثات التي يشارك فيها
DROP POLICY IF EXISTS "conversations_select" ON conversations;
CREATE POLICY "conversations_select" ON conversations
    FOR SELECT USING (
        -- مشارك في المحادثة (باستخدام دالة SECURITY DEFINER لتجنب recursion)
        messaging_is_participant(id, auth.uid())
        OR
        -- الإعلانات العامة
        (type = 'broadcast' AND target_all = true)
        OR
        -- الإعلانات للدور المستهدف
        (type = 'broadcast' AND target_role IN (
            SELECT r.name FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid()
        ))
        OR
        -- المدير يرى كل المحادثات
        messaging_is_manager(auth.uid())
    );

-- إنشاء محادثة
DROP POLICY IF EXISTS "conversations_insert" ON conversations;
CREATE POLICY "conversations_insert" ON conversations
    FOR INSERT WITH CHECK (
        auth.uid() = created_by
    );

-- تحديث المحادثة (المنشئ أو المدير)
DROP POLICY IF EXISTS "conversations_update" ON conversations;
CREATE POLICY "conversations_update" ON conversations
    FOR UPDATE USING (
        created_by = auth.uid()
        OR
        messaging_is_manager(auth.uid())
    );

-- =============================================================================
-- 7. سياسات RLS - conversation_participants
-- =============================================================================

-- رؤية المشاركين في المحادثات التي أشارك فيها
-- ملاحظة: استخدام is_conversation_participant لتجنب التكرار اللانهائي
DROP POLICY IF EXISTS "participants_select" ON conversation_participants;
CREATE POLICY "participants_select" ON conversation_participants
    FOR SELECT USING (
        -- المستخدم يرى المشاركين في المحادثات التي هو مشارك فيها
        messaging_is_participant(conversation_id, auth.uid())
        OR
        -- أو المستخدم مدير يرى الكل
        messaging_is_manager(auth.uid())
    );

-- إضافة مشاركين (المنشئ يضيف نفسه أو المدير)
DROP POLICY IF EXISTS "participants_insert" ON conversation_participants;
CREATE POLICY "participants_insert" ON conversation_participants
    FOR INSERT WITH CHECK (
        -- المنشئ يضيف نفسه عند إنشاء المحادثة
        user_id = auth.uid()
        OR
        -- المدير
        messaging_is_manager(auth.uid())
    );

-- تحديث المشاركة (المستخدم نفسه أو المدير)
DROP POLICY IF EXISTS "participants_update" ON conversation_participants;
CREATE POLICY "participants_update" ON conversation_participants
    FOR UPDATE USING (
        user_id = auth.uid()
        OR
        messaging_is_manager(auth.uid())
    );

-- =============================================================================
-- 8. سياسات RLS - messages
-- =============================================================================

-- رؤية الرسائل في المحادثات التي أشارك فيها
DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages
    FOR SELECT USING (
        messaging_is_participant(conversation_id, auth.uid())
        OR
        messaging_is_manager(auth.uid())
    );

-- إرسال رسالة (مشارك نشط)
DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid()
        AND
        messaging_is_participant(conversation_id, auth.uid())
    );

-- تحديث الرسالة (المرسل فقط)
DROP POLICY IF EXISTS "messages_update" ON messages;
CREATE POLICY "messages_update" ON messages
    FOR UPDATE USING (
        sender_id = auth.uid()
    );

-- =============================================================================
-- 9. سياسات RLS - message_read_receipts
-- =============================================================================

DROP POLICY IF EXISTS "receipts_select" ON message_read_receipts;
CREATE POLICY "receipts_select" ON message_read_receipts
    FOR SELECT USING (
        user_id = auth.uid()
        OR
        messaging_is_manager(auth.uid())
    );

DROP POLICY IF EXISTS "receipts_insert" ON message_read_receipts;
CREATE POLICY "receipts_insert" ON message_read_receipts
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- 10. Functions - تحديث آخر رسالة في المحادثة
-- =============================================================================

CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET 
        last_message_id = NEW.id,
        last_message_at = NEW.created_at,
        last_message_preview = LEFT(NEW.content, 100),
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    
    -- زيادة عداد الرسائل غير المقروءة لكل المشاركين عدا المرسل
    UPDATE conversation_participants
    SET unread_count = unread_count + 1
    WHERE conversation_id = NEW.conversation_id
    AND user_id != NEW.sender_id
    AND is_active = true;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_last_message ON messages;
CREATE TRIGGER trigger_update_last_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_last_message();

-- =============================================================================
-- 11. Function - تصفير عداد الرسائل غير المقروءة
-- =============================================================================

CREATE OR REPLACE FUNCTION mark_conversation_as_read(p_conversation_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE conversation_participants
    SET 
        unread_count = 0,
        last_read_at = NOW(),
        last_read_message_id = (
            SELECT id FROM messages 
            WHERE conversation_id = p_conversation_id 
            ORDER BY created_at DESC LIMIT 1
        ),
        updated_at = NOW()
    WHERE conversation_id = p_conversation_id
    AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 12. Function - إنشاء محادثة مباشرة (أو إرجاع الموجودة)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_or_create_direct_conversation(p_other_user_id UUID)
RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
    v_current_user_id UUID := auth.uid();
BEGIN
    -- البحث عن محادثة موجودة
    SELECT c.id INTO v_conversation_id
    FROM conversations c
    JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = v_current_user_id
    JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = p_other_user_id
    WHERE c.type = 'direct'
    AND cp1.is_active = true
    AND cp2.is_active = true
    LIMIT 1;
    
    -- إذا لم توجد، إنشاء محادثة جديدة
    IF v_conversation_id IS NULL THEN
        INSERT INTO conversations (type, created_by)
        VALUES ('direct', v_current_user_id)
        RETURNING id INTO v_conversation_id;
        
        -- إضافة المشاركين
        INSERT INTO conversation_participants (conversation_id, user_id, role)
        VALUES 
            (v_conversation_id, v_current_user_id, 'admin'),
            (v_conversation_id, p_other_user_id, 'admin');
    END IF;
    
    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 13. Function - إنشاء محادثة فريق
-- =============================================================================

CREATE OR REPLACE FUNCTION create_team_conversation(p_team_id UUID)
RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
    v_team_name VARCHAR;
BEGIN
    -- التحقق من عدم وجود محادثة للفريق
    SELECT id INTO v_conversation_id
    FROM conversations
    WHERE team_id = p_team_id AND type = 'team' AND is_active = true;
    
    IF v_conversation_id IS NOT NULL THEN
        RETURN v_conversation_id;
    END IF;
    
    -- جلب اسم الفريق
    SELECT name INTO v_team_name FROM teams WHERE id = p_team_id;
    
    -- إنشاء المحادثة
    INSERT INTO conversations (type, title, team_id, created_by)
    VALUES ('team', 'فريق ' || COALESCE(v_team_name, ''), p_team_id, auth.uid())
    RETURNING id INTO v_conversation_id;
    
    -- إضافة كل أعضاء الفريق (عبر جدول team_members)
    INSERT INTO conversation_participants (conversation_id, user_id, role)
    SELECT v_conversation_id, tm.worker_id, 
           CASE WHEN tm.worker_id = auth.uid() THEN 'admin' ELSE 'member' END
    FROM team_members tm
    JOIN users u ON u.id = tm.worker_id
    WHERE tm.team_id = p_team_id 
    AND tm.left_at IS NULL 
    AND u.is_active = true;
    
    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 14. Function - إرسال إعلان Broadcast
-- =============================================================================

CREATE OR REPLACE FUNCTION create_broadcast(
    p_title VARCHAR,
    p_message TEXT,
    p_target_role VARCHAR DEFAULT NULL,
    p_target_all BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
    v_sender_id UUID := auth.uid();
BEGIN
    -- التحقق من صلاحية المدير
    IF NOT EXISTS (
        SELECT 1 FROM users u 
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = v_sender_id 
        AND r.name IN ('manager', 'operations_supervisor')
    ) THEN
        RAISE EXCEPTION 'غير مصرح لك بإرسال إعلانات';
    END IF;
    
    -- إنشاء المحادثة/الإعلان
    INSERT INTO conversations (type, title, target_role, target_all, created_by)
    VALUES ('broadcast', p_title, p_target_role, p_target_all, v_sender_id)
    RETURNING id INTO v_conversation_id;
    
    -- إضافة المستهدفين كمشاركين
    IF p_target_all THEN
        INSERT INTO conversation_participants (conversation_id, user_id, role)
        SELECT v_conversation_id, u.id, 'member'
        FROM users u
        WHERE u.is_active = true AND u.id != v_sender_id;
    ELSIF p_target_role IS NOT NULL THEN
        INSERT INTO conversation_participants (conversation_id, user_id, role)
        SELECT v_conversation_id, u.id, 'member'
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE r.name = p_target_role AND u.is_active = true AND u.id != v_sender_id;
    END IF;
    
    -- إضافة المرسل كـ admin
    INSERT INTO conversation_participants (conversation_id, user_id, role)
    VALUES (v_conversation_id, v_sender_id, 'admin');
    
    -- إرسال الرسالة
    INSERT INTO messages (conversation_id, sender_id, content)
    VALUES (v_conversation_id, v_sender_id, p_message);
    
    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 15. Trigger - إرسال Push Notification عند رسالة جديدة
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_on_new_message()
RETURNS TRIGGER AS $$
DECLARE
    v_sender_name VARCHAR;
    v_conversation_title VARCHAR;
    v_participant RECORD;
BEGIN
    -- جلب اسم المرسل
    SELECT full_name INTO v_sender_name FROM users WHERE id = NEW.sender_id;
    
    -- جلب عنوان المحادثة
    SELECT COALESCE(title, 'محادثة') INTO v_conversation_title 
    FROM conversations WHERE id = NEW.conversation_id;
    
    -- إرسال إشعار لكل مشارك (عدا المرسل وغير المكتومين)
    FOR v_participant IN 
        SELECT cp.user_id 
        FROM conversation_participants cp
        WHERE cp.conversation_id = NEW.conversation_id
        AND cp.user_id != NEW.sender_id
        AND cp.is_active = true
        AND cp.is_muted = false
    LOOP
        BEGIN
            INSERT INTO notifications (
                user_id, 
                type, 
                category,
                title, 
                message, 
                priority,
                reference_type,
                reference_id,
                action_url
            ) VALUES (
                v_participant.user_id,
                'new_message',
                'messages',
                v_sender_name,
                LEFT(NEW.content, 100),
                'medium',
                'messages',
                NEW.conversation_id,
                '/messages/' || NEW.conversation_id
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to create notification for user %: %', v_participant.user_id, SQLERRM;
        END;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_new_message ON messages;
CREATE TRIGGER trigger_notify_new_message
    AFTER INSERT ON messages
    FOR EACH ROW
    WHEN (NEW.is_system = false)
    EXECUTE FUNCTION notify_on_new_message();

-- =============================================================================
-- 16. صلاحيات
-- =============================================================================

GRANT SELECT, INSERT, UPDATE ON conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON messages TO authenticated;
GRANT SELECT, INSERT ON message_read_receipts TO authenticated;

GRANT ALL ON conversations, conversation_participants, messages, message_read_receipts TO service_role;

GRANT EXECUTE ON FUNCTION mark_conversation_as_read TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_direct_conversation TO authenticated;
GRANT EXECUTE ON FUNCTION create_team_conversation TO authenticated;
GRANT EXECUTE ON FUNCTION create_broadcast TO authenticated;

-- =============================================================================
-- 17. View - محادثات المستخدم مع التفاصيل
-- =============================================================================

CREATE OR REPLACE VIEW user_conversations AS
SELECT 
    c.id,
    c.type,
    c.title,
    c.avatar_url,
    c.team_id,
    c.last_message_at,
    c.last_message_preview,
    c.is_pinned,
    c.created_at,
    cp.unread_count,
    cp.is_muted,
    cp.last_read_at,
    -- للمحادثات المباشرة، جلب معلومات الطرف الآخر
    CASE 
        WHEN c.type = 'direct' THEN (
            SELECT u.full_name 
            FROM conversation_participants cp2
            JOIN users u ON u.id = cp2.user_id
            WHERE cp2.conversation_id = c.id 
            AND cp2.user_id != cp.user_id
            LIMIT 1
        )
        ELSE c.title
    END as display_name,
    -- avatar_url غير موجود في جدول users حالياً
    c.avatar_url as display_avatar
FROM conversations c
JOIN conversation_participants cp ON cp.conversation_id = c.id
WHERE cp.user_id = auth.uid()
AND cp.is_active = true
ORDER BY c.is_pinned DESC, c.last_message_at DESC NULLS LAST;

GRANT SELECT ON user_conversations TO authenticated;

-- =============================================================================
-- نهاية الملف
-- =============================================================================
