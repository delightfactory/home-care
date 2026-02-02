-- =====================================================
-- Migration: إنشاء دور الفني مع تبديل الدور التلقائي
-- =====================================================

-- 1. إنشاء دور الفني (technician)
INSERT INTO roles (name, name_ar, permissions, description, is_active)
VALUES (
  'technician',
  'فني',
  '{
    "customers": {"create": false, "read": true, "update": false, "delete": false},
    "services": {"create": false, "read": true, "update": false, "delete": false},
    "workers": {"create": false, "read": true, "update": false, "delete": false},
    "teams": {"create": false, "read": true, "update": false, "delete": false},
    "orders": {"create": false, "read": true, "update": true, "delete": false, "assign": false, "team_only": true},
    "routes": {"create": false, "read": true, "update": false, "delete": false, "team_only": true},
    "expenses": {"create": true, "read": true, "update": true, "delete": false, "approve": false, "limit": 100, "team_only": true},
    "reports": {"create": false, "read": true, "update": false, "delete": false, "export": false, "team_only": true},
    "settings": {"create": false, "read": false, "update": false, "delete": false},
    "users": {"create": false, "read": false, "update": false, "delete": false, "manage_roles": false},
    "admin": false
  }',
  'فني يعمل ضمن فريق ويمكنه تحديث حالة الطلبات وتسجيل مصروفات محدودة',
  true
)
ON CONFLICT (name) DO UPDATE
SET 
  name_ar = EXCLUDED.name_ar,
  permissions = EXCLUDED.permissions,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 2. دالة تبديل الدور تلقائياً عند تغيير قائد الفريق
CREATE OR REPLACE FUNCTION sync_worker_role_on_leader_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_technician_role_id UUID;
  v_team_leader_role_id UUID;
  v_old_leader_user_id UUID;
  v_new_leader_user_id UUID;
  v_still_leads_other_team BOOLEAN;
BEGIN
  -- جلب IDs الأدوار
  SELECT id INTO v_technician_role_id FROM roles WHERE name = 'technician';
  SELECT id INTO v_team_leader_role_id FROM roles WHERE name = 'team_leader';
  
  -- التحقق من وجود الأدوار (إذا لم توجد نتوقف)
  IF v_technician_role_id IS NULL OR v_team_leader_role_id IS NULL THEN
    RAISE NOTICE 'sync_worker_role: أحد الأدوار غير موجود (technician أو team_leader)';
    RETURN NEW;
  END IF;

  -- معالجة القائد السابق (إذا تم إزالته أو استبداله)
  IF OLD.leader_id IS NOT NULL AND OLD.leader_id IS DISTINCT FROM NEW.leader_id THEN
    -- جلب user_id للقائد السابق من جدول workers
    SELECT user_id INTO v_old_leader_user_id 
    FROM workers 
    WHERE id = OLD.leader_id;
    
    IF v_old_leader_user_id IS NOT NULL THEN
      -- التحقق هل يقود فرق أخرى؟
      SELECT EXISTS(
        SELECT 1 FROM teams 
        WHERE leader_id = OLD.leader_id 
          AND id != NEW.id
          AND is_active = true
      ) INTO v_still_leads_other_team;
      
      -- تغيير الدور فقط إذا لم يعد يقود أي فريق نشط
      IF NOT v_still_leads_other_team THEN
        UPDATE users 
        SET role_id = v_technician_role_id, 
            updated_at = NOW()
        WHERE id = v_old_leader_user_id 
          AND role_id = v_team_leader_role_id;
          
        RAISE NOTICE 'sync_worker_role: تم تغيير دور المستخدم % من team_leader إلى technician', v_old_leader_user_id;
      ELSE
        RAISE NOTICE 'sync_worker_role: المستخدم % لا يزال يقود فرق أخرى', v_old_leader_user_id;
      END IF;
    END IF;
  END IF;

  -- معالجة القائد الجديد (إذا تم تعيينه)
  IF NEW.leader_id IS NOT NULL AND NEW.leader_id IS DISTINCT FROM OLD.leader_id THEN
    -- جلب user_id للقائد الجديد من جدول workers
    SELECT user_id INTO v_new_leader_user_id 
    FROM workers 
    WHERE id = NEW.leader_id;
    
    IF v_new_leader_user_id IS NOT NULL THEN
      -- ترقية الدور من technician إلى team_leader
      UPDATE users 
      SET role_id = v_team_leader_role_id, 
          updated_at = NOW()
      WHERE id = v_new_leader_user_id 
        AND role_id = v_technician_role_id;
        
      RAISE NOTICE 'sync_worker_role: تم ترقية المستخدم % من technician إلى team_leader', v_new_leader_user_id;
    ELSE
      RAISE NOTICE 'sync_worker_role: العامل الجديد % ليس له حساب مستخدم', NEW.leader_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. إنشاء التريجر على جدول teams
DROP TRIGGER IF EXISTS teams_sync_role_on_leader_change ON teams;

CREATE TRIGGER teams_sync_role_on_leader_change
AFTER UPDATE OF leader_id ON teams
FOR EACH ROW
EXECUTE FUNCTION sync_worker_role_on_leader_change();

-- 4. منح الصلاحيات اللازمة
GRANT EXECUTE ON FUNCTION sync_worker_role_on_leader_change() TO authenticated;

-- 5. تعليق توضيحي
COMMENT ON FUNCTION sync_worker_role_on_leader_change() IS 
'تريجر يُبدّل دور المستخدم تلقائياً عند منح/سحب شارة قيادة الفريق:
- عند تعيين قائد جديد: technician → team_leader
- عند إزالة قائد: team_leader → technician (إذا لم يقد فرق أخرى)';
