-- ===========================================
-- Migration: Voice Calls Enhancement
-- إضافة caller_name لجدول المكالمات
-- ===========================================

-- إضافة عمود caller_name للمكالمات
ALTER TABLE voice_calls 
ADD COLUMN IF NOT EXISTS caller_name TEXT;

-- تحديث المكالمات الموجودة بأسماء المتصلين
UPDATE voice_calls vc
SET caller_name = u.full_name
FROM users u
WHERE vc.caller_id = u.id AND vc.caller_name IS NULL;

-- ⚠️ ملاحظة: لا نُعيد تعريف log_cleanup_completed
-- لأنها موجودة مسبقاً في receipts_storage_bucket.sql
-- وتعديلها سيُعطّل نظام cleanup-receipts

-- إضافة voice_messages إلى جدول تتبع التخزين
INSERT INTO storage_usage (bucket_id, notes)
VALUES ('voice_messages', 'Voice messages storage bucket')
ON CONFLICT (bucket_id) DO NOTHING;
