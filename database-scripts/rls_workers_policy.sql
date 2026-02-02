-- ============================================================
-- RLS Policy: السماح للمستخدم بقراءة بيانات worker المرتبط به
-- هذا يحل خطأ 406 عند استعلام workers بـ user_id
-- ============================================================

-- 1) إضافة سياسة للسماح للمستخدم بقراءة worker المرتبط به
DROP POLICY IF EXISTS "workers_select_own" ON workers;

CREATE POLICY "workers_select_own" ON workers
FOR SELECT USING (
  -- المستخدم يستطيع قراءة worker المرتبط به
  user_id = auth.uid()
  OR
  -- أو لديه صلاحية قراءة العمال
  check_user_permission('workers', 'read')
);

-- 2) (اختياري) تحديث التريجر لتجنب التعارض مع Edge Functions
-- إذا كان المستخدم موجوداً بالفعل، لا تفعل شيئاً
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO users (id, full_name, role_id, is_active)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    (SELECT id FROM roles WHERE name = 'pending'), 
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_auth_user failed: %', SQLERRM;
  RETURN new;
END;
$$;

-- 3) التأكد من أن التريجر موجود
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE handle_new_auth_user();

-- ============================================================
-- ملاحظة: هذا السكريبت يجب تنفيذه في Supabase SQL Editor
-- ============================================================
