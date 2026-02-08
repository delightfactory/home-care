-- ===========================================
-- Migration: Voice Calls Push Notifications
-- إشعارات Push للمكالمات الواردة
-- ===========================================
-- يعتمد على: 202_voice_calls_enhancement.sql (caller_name column)

-- 0. تفعيل pg_net extension (مطلوب لإرسال HTTP requests)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 1. جدول إعدادات آمن للـ Push Notifications
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- إدراج الإعدادات المطلوبة
INSERT INTO app_settings (key, value, description) VALUES
  ('supabase_url', 'https://gojvsvkleenaipzirhsm.supabase.co', 'Supabase Project URL'),
  ('service_role_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvanZzdmtsZWVuYWlwemlyaHNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzAyNTYzOSwiZXhwIjoyMDY4NjAxNjM5fQ.dAeWg15D4yy6SEOcp8soM2Bpz7xohW1fv-eFTk1v0Lw', 'Supabase Service Role Key')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- RLS للجدول (قراءة فقط للـ service role)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- لا توجد سياسات للمستخدمين العاديين - فقط service role يمكنه القراءة
-- الدوال SECURITY DEFINER يمكنها القراءة

-- 2. تحديث الـ INSERT لإضافة caller_name تلقائياً
CREATE OR REPLACE FUNCTION set_caller_name_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- جلب اسم المتصل من جدول users
  SELECT full_name INTO NEW.caller_name
  FROM users WHERE id = NEW.caller_id;
  
  -- إذا لم يوجد اسم، استخدم قيمة افتراضية
  IF NEW.caller_name IS NULL THEN
    NEW.caller_name := 'مستخدم';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- إنشاء الـ trigger
DROP TRIGGER IF EXISTS set_caller_name_trigger ON voice_calls;
CREATE TRIGGER set_caller_name_trigger
  BEFORE INSERT ON voice_calls
  FOR EACH ROW
  WHEN (NEW.caller_name IS NULL)
  EXECUTE FUNCTION set_caller_name_on_insert();

-- 3. دالة إرسال إشعار Push للمكالمات الواردة
CREATE OR REPLACE FUNCTION notify_incoming_call()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_name TEXT;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- جلب الإعدادات من الجدول
  SELECT value INTO v_supabase_url FROM app_settings WHERE key = 'supabase_url';
  SELECT value INTO v_service_key FROM app_settings WHERE key = 'service_role_key';
  
  -- تحقق من وجود الإعدادات
  IF v_supabase_url IS NULL OR v_service_key IS NULL THEN
    RAISE WARNING 'Missing supabase_url or service_role_key in app_settings table';
    RETURN NEW;
  END IF;
  
  -- جلب اسم المتصل
  v_caller_name := COALESCE(NEW.caller_name, 'مستخدم');
  
  -- إرسال Push عبر pg_net
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/send_push_notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    )::jsonb,
    body := jsonb_build_object(
      'user_id', NEW.callee_id::text,
      'title', 'مكالمة واردة 📞',
      'message', v_caller_name || ' يتصل بك',
      'url', '/',
      'data', jsonb_build_object(
        'type', 'incoming_call',
        'call_id', NEW.id::text,
        'caller_id', NEW.caller_id::text,
        'caller_name', v_caller_name,
        'channel_name', NEW.channel_name
      )
    )::jsonb
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- لا نوقف العملية إذا فشل الإشعار
    RAISE WARNING 'Failed to send call notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. إنشاء Trigger على المكالمات الجديدة في حالة ringing فقط
DROP TRIGGER IF EXISTS notify_incoming_call_trigger ON voice_calls;
CREATE TRIGGER notify_incoming_call_trigger
  AFTER INSERT ON voice_calls
  FOR EACH ROW
  WHEN (NEW.status = 'ringing')
  EXECUTE FUNCTION notify_incoming_call();

-- 5. تعليق توضيحي
COMMENT ON FUNCTION notify_incoming_call() IS 
'يرسل إشعار Push للمستقبل عند استقبال مكالمة واردة.
يقرأ الإعدادات من جدول app_settings.';

COMMENT ON TABLE app_settings IS 
'جدول إعدادات التطبيق - يحتوي على مفاتيح وقيم حساسة';
