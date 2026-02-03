-- =============================================================================
-- إشعارات نظام الرسائل
-- تاريخ: 2026-02-03
-- يُرسل إشعارات push وداخلية لجميع المشاركين عند استلام رسالة جديدة
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. دالة إرسال إشعار لكل مشارك في المحادثة عند وصول رسالة جديدة
-- =============================================================================
CREATE OR REPLACE FUNCTION notify_on_message_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_participant RECORD;
    v_sender_name TEXT;
    v_conversation_title TEXT;
    v_conversation_type TEXT;
    v_preview TEXT;
    v_action_url TEXT;
BEGIN
    -- تجاهل رسائل النظام
    IF NEW.is_system = true THEN
        RETURN NEW;
    END IF;

    -- جلب معلومات المرسل
    SELECT full_name INTO v_sender_name
    FROM users
    WHERE id = NEW.sender_id;

    -- جلب معلومات المحادثة
    SELECT 
        COALESCE(title, 'محادثة') AS title,
        type
    INTO v_conversation_title, v_conversation_type
    FROM conversations
    WHERE id = NEW.conversation_id;

    -- تجهيز معاينة الرسالة
    v_preview := CASE 
        WHEN NEW.content_type = 'image' THEN '📷 صورة'
        WHEN NEW.content_type = 'file' THEN '📎 مرفق'
        WHEN NEW.content_type = 'voice' THEN '🎤 رسالة صوتية'
        ELSE SUBSTRING(COALESCE(NEW.content, '') FROM 1 FOR 50)
    END;

    -- رابط الإجراء
    v_action_url := '/messages/' || NEW.conversation_id;

    -- إرسال إشعار لكل مشارك (ما عدا المرسل)
    FOR v_participant IN
        SELECT 
            cp.user_id,
            cp.is_muted
        FROM conversation_participants cp
        WHERE cp.conversation_id = NEW.conversation_id
        AND cp.user_id != NEW.sender_id
        AND cp.is_active = true
    LOOP
        -- تخطي المستخدمين الذين كتموا المحادثة
        IF v_participant.is_muted = true THEN
            CONTINUE;
        END IF;

        BEGIN
            -- إنشاء إشعار داخلي
            PERFORM create_notification(
                v_participant.user_id,
                'message_received',
                'messages',
                CASE v_conversation_type
                    WHEN 'direct' THEN '💬 ' || COALESCE(v_sender_name, 'رسالة جديدة')
                    WHEN 'team' THEN '👥 ' || v_conversation_title
                    WHEN 'group' THEN '👥 ' || v_conversation_title
                    WHEN 'broadcast' THEN '📢 ' || v_conversation_title
                    ELSE '💬 رسالة جديدة'
                END,
                CASE v_conversation_type
                    WHEN 'direct' THEN v_preview
                    ELSE COALESCE(v_sender_name, '') || ': ' || v_preview
                END,
                'medium',
                'messages',
                NEW.id,
                v_action_url
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to send notification for message % to user %: %', 
                NEW.id, v_participant.user_id, SQLERRM;
        END;
    END LOOP;

    RETURN NEW;
END;
$$;

-- =============================================================================
-- 2. ربط الـ Trigger بجدول messages
-- =============================================================================
DROP TRIGGER IF EXISTS trigger_notify_on_message ON messages;
CREATE TRIGGER trigger_notify_on_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_message_received();

-- =============================================================================
-- 3. منح الصلاحيات
-- =============================================================================
GRANT EXECUTE ON FUNCTION notify_on_message_received TO service_role;

COMMIT;

-- =============================================================================
-- ملاحظة: تأكد من تنفيذ ملف 20260203_notifications_system.sql أولاً
-- حيث يحتوي على دالة create_notification المطلوبة
-- =============================================================================
