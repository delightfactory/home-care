-- ================================================================
-- نظام النسخ الاحتياطية المجدولة
-- يستخدم دالة SQL مباشرة بدلاً من Edge Function
-- ================================================================

-- الحل: استدعاء دالة create_backup_internal مباشرة من pg_cron
-- هذا يتجاوز حدود Edge Function ويعمل داخل PostgreSQL

-- ================================================================
-- الخطوة 1: إنشاء دالة مبسطة للنسخ الاحتياطي (بدون إرجاع البيانات)
-- ================================================================
CREATE OR REPLACE FUNCTION create_scheduled_backup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  t text;
  row_data jsonb;
  backup_json jsonb := '{}'::jsonb;
  backup_label text;
BEGIN
  -- تعيين حدود زمنية أطول
  PERFORM set_config('lock_timeout', '30s', true);
  PERFORM set_config('statement_timeout', '600s', true);  -- 10 دقائق
  
  -- إنشاء التسمية
  backup_label := 'Auto ' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI');
  
  -- تجميع محتوى كل جدول بنفس الترتيب
  FOREACH t IN ARRAY ARRAY[
    -- جداول مرجعية
    'roles','customers','workers','teams','team_members',
    'service_categories','services','expense_categories','system_settings',
    -- جداول تشغيلية
    'orders','order_items','order_status_logs',
    'routes','route_orders','order_workers',
    'expenses','daily_reports','team_performance','performance_logs'
  ] LOOP
    EXECUTE format(
      'SELECT coalesce(jsonb_agg(to_jsonb(r)), ''[]'') FROM %I r', t
    ) INTO row_data;
    backup_json := backup_json || jsonb_build_object(t, row_data);
    RAISE NOTICE 'Backed up table: %', t;
  END LOOP;

  -- حفظ النسخة
  INSERT INTO backups(label, created_by, size_bytes, checksum_sha256, payload)
  VALUES (
    backup_label,
    NULL,  -- تلقائي
    pg_column_size(backup_json),
    encode(digest(backup_json::text, 'sha256'), 'hex'),
    backup_json
  );
  
  RAISE NOTICE 'Backup created: %', backup_label;
  
  -- تنظيف النسخ القديمة - الاحتفاظ بآخر 5
  DELETE FROM backups
  WHERE id IN (
    SELECT id FROM backups
    ORDER BY created_at DESC
    OFFSET 5
  );
  
  RAISE NOTICE 'Old backups cleaned up';
END;
$$;

-- ================================================================
-- الخطوة 2: جدولة النسخ اليومية
-- ================================================================
-- كل يوم الساعة 1:00 AM UTC = 3:00 AM توقيت مصر
SELECT cron.schedule(
  'daily-backup',
  '0 1 * * *',
  $$SELECT create_scheduled_backup()$$
);

-- ================================================================
-- أوامر مفيدة
-- ================================================================

-- عرض المهام المجدولة:
-- SELECT * FROM cron.job;

-- عرض سجل التنفيذ:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- تشغيل يدوي:
-- SELECT create_scheduled_backup();

-- إيقاف الجدولة:
-- SELECT cron.unschedule('daily-backup');

-- ================================================================
