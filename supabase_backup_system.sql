-- ================================================================
-- Supabase Backup / Restore / Reset System
-- Compatible with Supabase Free tier (no pg_cron / Edge Functions)
-- ================================================================
-- ملاحظة: نفِّذ هذا الملف بالكامل مرة واحدة فى SQL Editor داخل مشروع Supabase.
-- سيقوم بإنشاء بنية الدعم (جدول النسخ الاحتياطية + الدوال + سياسات RLS).
-- بعدها يمكن استدعاء الدوال RPC من الواجهة.

------------------------------------------------------------------
-- 0) امتدادات مطلوبة
------------------------------------------------------------------
create extension if not exists pgcrypto;   -- لحساب SHA-256

------------------------------------------------------------------
-- 1) جدول النسخ الاحتياطية + فهرس
------------------------------------------------------------------
create table if not exists backups (
  id            uuid primary key default gen_random_uuid(),
  label         text,
  created_at    timestamptz default now(),
  created_by    uuid references users(id),
  size_bytes    bigint,
  checksum_sha256 text,
  payload       jsonb         -- يمكن ضغطه إلى bytea لاحقًا
);

create index if not exists idx_backups_created_desc
  on backups(created_at desc);

------------------------------------------------------------------
-- 2) VIEW عام بدون عمود payload (للمستخدمين غير الإداريين)
------------------------------------------------------------------
create or replace view v_backups_public as
  select id, label, created_at, created_by, size_bytes
  from backups;

------------------------------------------------------------------
-- 3) تفعيل RLS وسياسات الأمان
------------------------------------------------------------------
alter table backups enable row level security;

-- قراءة الميتاداتا للجميع، التحقق يمنع التعديل لغير admin
create policy read_backups on backups
  for select using ( true );

-- صلاحيات كاملة لدور admin فقط
create policy manage_backups_admin on backups
  for all using  ( auth.role() = 'admin' )
           with check ( auth.role() = 'admin' );

------------------------------------------------------------------
-- 4) دالة ثابتة: ترتيب الجداول داخل النسخة الاحتياطية
------------------------------------------------------------------
create or replace function fn_tables_to_backup()
returns text[] language sql immutable as $$
  select array[
    -- جداول مرجعية (لا تُحذف فى reset)
    'roles','customers','workers','teams','team_members','service_categories','services',
    'expense_categories','system_settings',
    -- جداول تشغيلية (تُفرَّغ فى reset)
    'orders','order_items','order_status_logs',
    'routes','route_orders','order_workers',
    'expenses','daily_reports','team_performance','performance_logs'
  ];
$$;

------------------------------------------------------------------
-- 5) الدالة: إنشاء نسخة احتياطية وإعادتها
------------------------------------------------------------------
create or replace function create_backup_and_return(p_label text default null)
returns jsonb
language plpgsql security definer as $$
declare
  t text;
  row_data jsonb;
  backup_json jsonb := '{}'::jsonb;
  _uid uuid := coalesce(current_setting('request.jwt.claim.sub', true),NULL)::uuid;
begin
  -- حدود زمنية لحماية الأداء
  perform set_config('lock_timeout','5s',true);
  perform set_config('statement_timeout','120s',true);

  -- تجميع محتوى كل جدول
  -- تجميع محتوى كل جدول بدون أى تعبيرات فرعية قد تُعيد أكثر من صف
  FOREACH t IN ARRAY fn_tables_to_backup() LOOP
    EXECUTE format(
      'SELECT coalesce(jsonb_agg(to_jsonb(r)), ''[]'') FROM %I r', t
    ) INTO row_data;
    backup_json := backup_json || jsonb_build_object(t, row_data);
  END LOOP;

  -- احسب الحجم و التحقق
  insert into backups(label, created_by, size_bytes, checksum_sha256, payload)
  values (coalesce(p_label, to_char(now(),'YYYY-MM-DD HH24:MI')), _uid,
          pg_column_size(backup_json),
          encode(digest(backup_json::text, 'sha256'), 'hex'),
          backup_json);

  return backup_json;   -- يُحمَّل عبر الواجهة
end;
$$;

------------------------------------------------------------------
-- 6) الدالة: إعادة ضبط البيانات التشغيلية
------------------------------------------------------------------
create or replace function reset_operational_data()
returns void
language plpgsql security definer as $$
declare
  tbl text;
  op_tables text[] := array[
    'orders','order_items','order_status_logs',
    'routes','route_orders','order_workers',
    'expenses','daily_reports','team_performance','performance_logs'
  ];
begin
  perform set_config('lock_timeout','5s',true);
  perform set_config('statement_timeout','120s',true);

  -- تعطيل التريغرات مؤقتًا
  foreach tbl in array op_tables loop
    execute format('alter table %I disable trigger user', tbl);
  end loop;

  begin
    -- تفريغ الجداول التشغيلية مع إعادة تسلسل الهويات
    execute 'truncate ' || array_to_string(op_tables, ',') || ' restart identity cascade';
  exception when others then
    -- إعادة التريغرات ثم إعادة الخطأ
    foreach tbl in array op_tables loop
      execute format('alter table %I enable trigger user', tbl);
    end loop;
    raise;
  end;

  -- إعادة التريغرات بعد النجاح
  foreach tbl in array op_tables loop
    execute format('alter table %I enable trigger user', tbl);
  end loop;
end;
$$;

------------------------------------------------------------------
-- 7) الدالة: الاستعادة من نسخة احتياطية
------------------------------------------------------------------
create or replace function restore_from_backup(p_backup_id uuid)
returns void
language plpgsql security definer as $$
declare
  js  jsonb;
  tbl text;
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
begin
  perform set_config('lock_timeout','5s',true);
  perform set_config('statement_timeout','300s',true);

  -- جلب الـ payload
  select payload into js from backups where id = p_backup_id;
  if js is null then
    raise exception 'Backup % not found', p_backup_id;
  end if;

  -- تفريغ البيانات التشغيلية
  perform reset_operational_data();

  -- تعطيل جميع التريغرات (تشمل قيود FK) مؤقتًا
  foreach tbl in array (ref_tables || op_tables) loop
    if tbl <> 'order_status_logs' then
      execute format('alter table %I disable trigger user', tbl);
    end if;
  end loop;

  begin
    -- إدراج الجداول المرجعية
    foreach tbl in array ref_tables loop
      execute format(
        'insert into %I select * from jsonb_populate_recordset(null::%I, $1->%L) on conflict do nothing',
        tbl, tbl, tbl) using js;
    end loop;

    -- إدراج الجداول التشغيلية
    foreach tbl in array op_tables loop
      execute format(
        'insert into %I select * from jsonb_populate_recordset(null::%I, $1->%L)',
        tbl, tbl, tbl) using js;
    end loop;

  exception when others then
    -- إعادة التريغرات قبل إعادة الخطأ
    foreach tbl in array (ref_tables || op_tables) loop
      execute format('alter table %I enable trigger user', tbl);
    end loop;
    raise;
  end;

  -- إعادة التريغرات بعد نجاح الاستعادة
  foreach tbl in array (ref_tables || op_tables) loop
    execute format('alter table %I enable trigger user', tbl);
  end loop;
end;
$$;

------------------------------------------------------------------
-- 8) الدالة: تنظيف النسخ القديمة (اختيارى)
------------------------------------------------------------------
create or replace function prune_old_backups(max_keep int default 30, max_gb numeric default 1.0)
returns void language plpgsql security definer as $$
declare
  total_size bigint;
begin
  -- حذف حسب العدد
  delete from backups
  where id in (
    select id from backups
    order by created_at desc
    offset greatest(max_keep,0)
  );

  -- حذف حسب الحجم
  select coalesce(sum(size_bytes),0) into total_size from backups;
  while total_size > (max_gb * 1024*1024*1024) loop
    delete from backups
    where id = (select id from backups order by created_at asc limit 1);
    select sum(size_bytes) into total_size from backups;
  end loop;
end;
$$;

------------------------------------------------------------------
-- انتهى الاسكريبت
------------------------------------------------------------------
