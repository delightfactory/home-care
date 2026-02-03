-- =============================================================================
-- إصلاح مشاكل RLS ووظائف نظام الرسائل
-- تاريخ: 2026-02-03
-- المشاكل:
--   1. عدم ظهور المستخدمين عند إنشاء مجموعة (لغير المديرين)
--   2. فشل إرسال رسالة للفريق (المستخدم لا يُضاف كمشارك)
-- =============================================================================

-- =============================================================================
-- الإصلاح 1: السماح لجميع المستخدمين المسجلين برؤية المستخدمين الآخرين
-- =============================================================================

-- إضافة سياسة للسماح لجميع المستخدمين برؤية معلومات المستخدمين الأساسية
-- هذا ضروري لنظام الرسائل حتى يتمكن المستخدم من اختيار من يراسله
DROP POLICY IF EXISTS "Users can view other users for messaging" ON users;
CREATE POLICY "Users can view other users for messaging" ON users
    FOR SELECT USING (
        -- أي مستخدم مسجل يمكنه رؤية المستخدمين النشطين
        auth.uid() IS NOT NULL
    );

-- =============================================================================
-- الإصلاح 2: تعديل دالة create_team_conversation لإضافة المنشئ دائماً
-- =============================================================================

CREATE OR REPLACE FUNCTION create_team_conversation(p_team_id UUID)
RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
    v_team_name VARCHAR;
    v_creator_id UUID := auth.uid();
BEGIN
    -- التحقق من عدم وجود محادثة للفريق
    SELECT id INTO v_conversation_id
    FROM conversations
    WHERE team_id = p_team_id AND type = 'team' AND is_active = true;
    
    IF v_conversation_id IS NOT NULL THEN
        -- إذا كانت المحادثة موجودة، تأكد من أن المستخدم الحالي مشارك
        INSERT INTO conversation_participants (conversation_id, user_id, role)
        VALUES (v_conversation_id, v_creator_id, 'member')
        ON CONFLICT (conversation_id, user_id) DO NOTHING;
        
        RETURN v_conversation_id;
    END IF;
    
    -- جلب اسم الفريق
    SELECT name INTO v_team_name FROM teams WHERE id = p_team_id;
    
    -- إنشاء المحادثة
    INSERT INTO conversations (type, title, team_id, created_by)
    VALUES ('team', 'فريق ' || COALESCE(v_team_name, ''), p_team_id, v_creator_id)
    RETURNING id INTO v_conversation_id;
    
    -- إضافة منشئ المحادثة أولاً كـ admin
    INSERT INTO conversation_participants (conversation_id, user_id, role)
    VALUES (v_conversation_id, v_creator_id, 'admin')
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
    
    -- إضافة كل أعضاء الفريق (عبر جدول team_members)
    INSERT INTO conversation_participants (conversation_id, user_id, role)
    SELECT v_conversation_id, tm.worker_id, 'member'
    FROM team_members tm
    JOIN users u ON u.id = tm.worker_id
    WHERE tm.team_id = p_team_id 
    AND tm.left_at IS NULL 
    AND u.is_active = true
    AND tm.worker_id != v_creator_id  -- تجنب إضافة المنشئ مرتين
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
    
    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- الإصلاح 3: تعديل سياسة إدخال الرسائل لتكون أكثر مرونة
-- =============================================================================

-- السماح بإرسال رسالة إذا كان المستخدم مشاركاً أو منشئ المحادثة
DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid()
        AND (
            -- المستخدم مشارك في المحادثة
            messaging_is_participant(conversation_id, auth.uid())
            OR
            -- المستخدم هو منشئ المحادثة
            EXISTS (
                SELECT 1 FROM conversations c
                WHERE c.id = conversation_id
                AND c.created_by = auth.uid()
            )
            OR
            -- المستخدم مدير
            messaging_is_manager(auth.uid())
        )
    );

-- =============================================================================
-- الإصلاح 4: السماح للمستخدم بإضافة نفسه كمشارك
-- =============================================================================

DROP POLICY IF EXISTS "participants_insert" ON conversation_participants;
CREATE POLICY "participants_insert" ON conversation_participants
    FOR INSERT WITH CHECK (
        -- المستخدم يضيف نفسه
        user_id = auth.uid()
        OR
        -- المدير يمكنه إضافة أي شخص
        messaging_is_manager(auth.uid())
        OR
        -- منشئ المحادثة يمكنه إضافة مشاركين
        EXISTS (
            SELECT 1 FROM conversations c
            WHERE c.id = conversation_id
            AND c.created_by = auth.uid()
        )
    );

-- =============================================================================
-- نهاية الإصلاح
-- =============================================================================
