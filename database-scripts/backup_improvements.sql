-- ================================================================
-- تحسينات نظام النسخ الاحتياطية
-- آمن للتنفيذ - لا يؤثر على البيانات الحالية
-- ================================================================

-- ================================================================
-- المرحلة 1: تحسين دالة الاستعادة
-- ================================================================
-- التغييرات:
-- - زيادة statement_timeout من 300s إلى 600s (10 دقائق)
-- - إضافة تسجيل التقدم لكل جدول
-- - الحفاظ الكامل على التوافق مع النسخ القديمة

CREATE OR REPLACE FUNCTION restore_from_backup(p_backup_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  js  jsonb;
  tbl text;
  row_count int;
  ref_tables text[] := array[
    'roles','customers','workers','teams','team_members','service_categories','services',
    'expense_categories','system_settings'
  ];
  op_tables text[] := array[
    'routes',          -- لإنشاء FK قبل route_orders
    'orders',
    'route_orders',
    'order_workers',
    'order_items',
    'order_status_logs',
    'expenses',
    'daily_reports',
    'team_performance',
    'performance_logs'
  ];
BEGIN
  -- ⏱️ حدود زمنية محسّنة (10 دقائق)
  PERFORM set_config('lock_timeout', '30s', true);
  PERFORM set_config('statement_timeout', '600s', true);
  
  RAISE NOTICE '🔄 بدء عملية الاستعادة: %', p_backup_id;

  -- جلب الـ payload
  SELECT payload INTO js FROM backups WHERE id = p_backup_id;
  IF js IS NULL THEN
    RAISE EXCEPTION '❌ النسخة الاحتياطية غير موجودة: %', p_backup_id;
  END IF;
  
  RAISE NOTICE '✅ تم جلب النسخة الاحتياطية';

  -- تفريغ البيانات التشغيلية
  PERFORM reset_operational_data();
  RAISE NOTICE '✅ تم تفريغ البيانات التشغيلية';

  -- تعطيل جميع التريغرات مؤقتًا
  FOREACH tbl IN ARRAY (ref_tables || op_tables) LOOP
    IF tbl <> 'order_status_logs' THEN
      EXECUTE format('ALTER TABLE %I DISABLE TRIGGER USER', tbl);
    END IF;
  END LOOP;
  RAISE NOTICE '✅ تم تعطيل التريغرات';

  BEGIN
    -- إدراج الجداول المرجعية
    FOREACH tbl IN ARRAY ref_tables LOOP
      EXECUTE format(
        'INSERT INTO %I SELECT * FROM jsonb_populate_recordset(null::%I, $1->%L) ON CONFLICT DO NOTHING',
        tbl, tbl, tbl) USING js;
      GET DIAGNOSTICS row_count = ROW_COUNT;
      RAISE NOTICE '  📦 %: % صف', tbl, row_count;
    END LOOP;

    -- إدراج الجداول التشغيلية
    FOREACH tbl IN ARRAY op_tables LOOP
      EXECUTE format(
        'INSERT INTO %I SELECT * FROM jsonb_populate_recordset(null::%I, $1->%L)',
        tbl, tbl, tbl) USING js;
      GET DIAGNOSTICS row_count = ROW_COUNT;
      RAISE NOTICE '  📦 %: % صف', tbl, row_count;
    END LOOP;

  EXCEPTION WHEN OTHERS THEN
    -- إعادة التريغرات قبل إعادة الخطأ
    FOREACH tbl IN ARRAY (ref_tables || op_tables) LOOP
      EXECUTE format('ALTER TABLE %I ENABLE TRIGGER USER', tbl);
    END LOOP;
    RAISE NOTICE '❌ خطأ أثناء الاستعادة: %', SQLERRM;
    RAISE;
  END;

  -- إعادة التريغرات بعد نجاح الاستعادة
  FOREACH tbl IN ARRAY (ref_tables || op_tables) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE TRIGGER USER', tbl);
  END LOOP;
  
  RAISE NOTICE '🎉 تمت الاستعادة بنجاح!';
END;
$$;

-- ================================================================
-- المرحلة 2: تحديث دالة النسخ المجدول (3 نسخ بدلاً من 5)
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
  PERFORM set_config('statement_timeout', '600s', true);
  
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
  
  -- ✨ تنظيف النسخ القديمة - الاحتفاظ بآخر 3 فقط (بدلاً من 5)
  DELETE FROM backups
  WHERE id IN (
    SELECT id FROM backups
    ORDER BY created_at DESC
    OFFSET 3  -- ⚠️ تغيير من 5 إلى 3
  );
  
  RAISE NOTICE 'Old backups cleaned up (keeping last 3)';
END;
$$;

-- ================================================================
-- التحقق بعد التنفيذ
-- ================================================================
-- نفذ هذه الاستعلامات للتحقق:
--
-- 1. تحقق من وجود الدوال:
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_name IN ('restore_from_backup', 'create_scheduled_backup');
--
-- 2. تحقق من عدد النسخ الحالية:
-- SELECT COUNT(*) as backup_count FROM backups;
--
-- 3. عرض النسخ:
-- SELECT id, label, ROUND(size_bytes/1024.0/1024.0,2) as mb, created_at 
-- FROM backups ORDER BY created_at DESC;
-- ================================================================
