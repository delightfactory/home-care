-- =============================================================================
-- إصلاح عاجل - حل مشكلة التكرار اللانهائي في سياسات RLS
-- تاريخ: 2026-02-03
-- ملاحظة: نستخدم دوال جديدة بأسماء خاصة بنظام الرسائل فقط
-- =============================================================================

-- 1. دالة للتحقق من عضوية المحادثة (خاصة بنظام الرسائل)
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

-- 2. دالة للتحقق من كون المستخدم مديراً (خاصة بنظام الرسائل)
CREATE OR REPLACE FUNCTION messaging_is_manager(p_user_id UUID)
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

-- 3. منح الصلاحيات
GRANT EXECUTE ON FUNCTION messaging_is_participant TO authenticated;
GRANT EXECUTE ON FUNCTION messaging_is_manager TO authenticated;

-- =============================================================================
-- 4. تحديث سياسات conversations
-- =============================================================================

DROP POLICY IF EXISTS "conversations_select" ON conversations;
CREATE POLICY "conversations_select" ON conversations
    FOR SELECT USING (
        messaging_is_participant(id, auth.uid())
        OR
        (type = 'broadcast' AND target_all = true)
        OR
        (type = 'broadcast' AND target_role IN (
            SELECT r.name FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid()
        ))
        OR
        messaging_is_manager(auth.uid())
    );

DROP POLICY IF EXISTS "conversations_update" ON conversations;
CREATE POLICY "conversations_update" ON conversations
    FOR UPDATE USING (
        created_by = auth.uid()
        OR
        messaging_is_manager(auth.uid())
    );

-- =============================================================================
-- 5. تحديث سياسات conversation_participants
-- =============================================================================

DROP POLICY IF EXISTS "participants_select" ON conversation_participants;
CREATE POLICY "participants_select" ON conversation_participants
    FOR SELECT USING (
        messaging_is_participant(conversation_id, auth.uid())
        OR
        messaging_is_manager(auth.uid())
    );

DROP POLICY IF EXISTS "participants_insert" ON conversation_participants;
CREATE POLICY "participants_insert" ON conversation_participants
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        OR
        messaging_is_manager(auth.uid())
    );

DROP POLICY IF EXISTS "participants_update" ON conversation_participants;
CREATE POLICY "participants_update" ON conversation_participants
    FOR UPDATE USING (
        user_id = auth.uid()
        OR
        messaging_is_manager(auth.uid())
    );

-- =============================================================================
-- 6. تحديث سياسات messages
-- =============================================================================

DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages
    FOR SELECT USING (
        messaging_is_participant(conversation_id, auth.uid())
        OR
        messaging_is_manager(auth.uid())
    );

DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid()
        AND
        messaging_is_participant(conversation_id, auth.uid())
    );

-- messages_update يبقى كما هو (sender_id = auth.uid())

-- =============================================================================
-- 7. تحديث سياسات message_read_receipts
-- =============================================================================

DROP POLICY IF EXISTS "receipts_select" ON message_read_receipts;
CREATE POLICY "receipts_select" ON message_read_receipts
    FOR SELECT USING (
        user_id = auth.uid()
        OR
        messaging_is_manager(auth.uid())
    );

-- =============================================================================
-- نهاية الإصلاح
-- =============================================================================
