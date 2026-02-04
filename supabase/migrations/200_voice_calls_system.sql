-- ===========================================
-- Migration: Voice Calls System
-- نظام المكالمات الصوتية
-- ===========================================

-- 1. جدول المكالمات النشطة
CREATE TABLE IF NOT EXISTS voice_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_name TEXT UNIQUE NOT NULL,
  caller_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  callee_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'ringing' CHECK (status IN ('ringing', 'connecting', 'connected', 'ended', 'missed', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

-- فهرس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_voice_calls_caller ON voice_calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_voice_calls_callee ON voice_calls(callee_id);
CREATE INDEX IF NOT EXISTS idx_voice_calls_status ON voice_calls(status) WHERE status = 'ringing';

-- RLS
ALTER TABLE voice_calls ENABLE ROW LEVEL SECURITY;

-- سياسة: المستخدم يرى مكالماته فقط
CREATE POLICY "users_view_own_calls" ON voice_calls
  FOR SELECT USING (auth.uid() = caller_id OR auth.uid() = callee_id);

-- سياسة: المستخدم يمكنه إنشاء مكالمة
CREATE POLICY "users_create_calls" ON voice_calls
  FOR INSERT WITH CHECK (auth.uid() = caller_id);

-- سياسة: المستخدم يمكنه تحديث مكالماته
CREATE POLICY "users_update_own_calls" ON voice_calls
  FOR UPDATE USING (auth.uid() = caller_id OR auth.uid() = callee_id);

-- سياسة: المستخدم يمكنه حذف مكالماته المنتهية
CREATE POLICY "users_delete_ended_calls" ON voice_calls
  FOR DELETE USING (
    (auth.uid() = caller_id OR auth.uid() = callee_id) 
    AND status IN ('ended', 'missed', 'rejected')
  );

-- 2. جدول سجل المكالمات (للتاريخ)
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id UUID REFERENCES users(id) ON DELETE SET NULL,
  callee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  caller_name TEXT NOT NULL,
  callee_name TEXT NOT NULL,
  duration_seconds INT DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('completed', 'missed', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_call_logs_caller ON call_logs(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_callee ON call_logs(callee_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_created ON call_logs(created_at DESC);

-- RLS
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- سياسة: المستخدم يرى سجلاته فقط
CREATE POLICY "users_view_own_logs" ON call_logs
  FOR SELECT USING (auth.uid() = caller_id OR auth.uid() = callee_id);

-- 3. تفعيل Realtime للمكالمات
ALTER publication supabase_realtime ADD TABLE voice_calls;

-- 4. دالة لإنهاء المكالمات المعلقة (أكثر من دقيقة في حالة ringing)
CREATE OR REPLACE FUNCTION cleanup_stale_calls()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE voice_calls
  SET status = 'missed', ended_at = now()
  WHERE status = 'ringing' 
    AND created_at < now() - INTERVAL '1 minute';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. دالة لنقل المكالمة المنتهية للسجل
CREATE OR REPLACE FUNCTION log_completed_call(
  p_call_id UUID,
  p_status TEXT
)
RETURNS UUID AS $$
DECLARE
  v_call RECORD;
  v_log_id UUID;
  v_duration INT;
BEGIN
  -- جلب بيانات المكالمة
  SELECT vc.*, 
         u1.full_name as caller_name_val,
         u2.full_name as callee_name_val
  INTO v_call
  FROM voice_calls vc
  LEFT JOIN users u1 ON u1.id = vc.caller_id
  LEFT JOIN users u2 ON u2.id = vc.callee_id
  WHERE vc.id = p_call_id;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- حساب المدة
  IF v_call.answered_at IS NOT NULL THEN
    v_duration := EXTRACT(EPOCH FROM (now() - v_call.answered_at))::INT;
  ELSE
    v_duration := 0;
  END IF;
  
  -- إنشاء سجل
  INSERT INTO call_logs (caller_id, callee_id, caller_name, callee_name, duration_seconds, status)
  VALUES (
    v_call.caller_id,
    v_call.callee_id,
    COALESCE(v_call.caller_name_val, 'غير معروف'),
    COALESCE(v_call.callee_name_val, 'غير معروف'),
    v_duration,
    p_status
  )
  RETURNING id INTO v_log_id;
  
  -- حذف المكالمة النشطة
  DELETE FROM voice_calls WHERE id = p_call_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Bucket للرسائل الصوتية
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice_messages',
  'voice_messages',
  false,
  5242880, -- 5MB حد أقصى
  ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav']
)
ON CONFLICT (id) DO NOTHING;

-- RLS للـ bucket
CREATE POLICY "users_upload_voice" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'voice_messages' 
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "users_read_voice" ON storage.objects
  FOR SELECT USING (bucket_id = 'voice_messages');

CREATE POLICY "users_delete_own_voice" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'voice_messages' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
