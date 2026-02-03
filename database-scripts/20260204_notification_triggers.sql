-- ===================================
-- Notification Triggers - ربط الإشعارات بأحداث النظام
-- يُنفذ بعد migration الإشعارات الأساسي
-- Created: 2026-02-03
-- Updated: 2026-02-03 - Fixed role names to match actual system roles
-- ===================================

-- الأدوار الصحيحة في النظام:
-- manager = المدير العام (بدلاً من admin)
-- operations_supervisor = مشرف العمليات (بدلاً من supervisor)
-- receptionist = موظف الاستقبال (بدلاً من accountant)
-- team_leader = قائد الفريق
-- technician = فني

BEGIN;

-- ============================================
-- 1. Trigger لإشعار عند إنشاء طلب جديد
-- ============================================
CREATE OR REPLACE FUNCTION notify_on_order_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_customer_name TEXT;
BEGIN
    BEGIN
        SELECT name INTO v_customer_name
        FROM customers
        WHERE id = NEW.customer_id;

        -- إشعار للمدير العام
        PERFORM notify_users_by_role(
            'manager', 'order_created', 'orders',
            '🆕 طلب جديد',
            'تم إنشاء طلب جديد للعميل: ' || COALESCE(v_customer_name, 'غير معروف'),
            'medium', 'orders', NEW.id, '/orders'
        );

        -- إشعار لمشرف العمليات
        PERFORM notify_users_by_role(
            'operations_supervisor', 'order_created', 'orders',
            '🆕 طلب جديد',
            'تم إنشاء طلب جديد للعميل: ' || COALESCE(v_customer_name, 'غير معروف'),
            'medium', 'orders', NEW.id, '/orders'
        );

        -- إشعار لموظف الاستقبال
        PERFORM notify_users_by_role(
            'receptionist', 'order_created', 'orders',
            '🆕 طلب جديد',
            'تم إنشاء طلب جديد للعميل: ' || COALESCE(v_customer_name, 'غير معروف'),
            'low', 'orders', NEW.id, '/orders'
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Notification trigger failed for order %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_order_created ON orders;
CREATE TRIGGER trigger_notify_order_created
    AFTER INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_order_created();

-- ============================================
-- 2. Trigger لإشعار عند تغيير حالة الطلب
-- ============================================
CREATE OR REPLACE FUNCTION notify_on_order_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status_text TEXT;
    v_customer_name TEXT;
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    BEGIN
        v_status_text := CASE NEW.status
            WHEN 'pending' THEN 'قيد الانتظار'
            WHEN 'scheduled' THEN 'تم الجدولة'
            WHEN 'in_progress' THEN 'قيد التنفيذ'
            WHEN 'completed' THEN 'مكتمل'
            WHEN 'cancelled' THEN 'ملغي'
            ELSE NEW.status
        END;

        SELECT name INTO v_customer_name
        FROM customers
        WHERE id = NEW.customer_id;

        -- إشعار للمدير العام
        PERFORM notify_users_by_role(
            'manager', 'order_status_changed', 'orders',
            '📋 تحديث حالة طلب',
            'تم تحديث حالة الطلب للعميل ' || COALESCE(v_customer_name, 'غير معروف') || ' إلى: ' || v_status_text,
            CASE WHEN NEW.status IN ('cancelled', 'completed') THEN 'high' ELSE 'medium' END,
            'orders', NEW.id, '/orders'
        );

        -- إشعار لمشرف العمليات
        PERFORM notify_users_by_role(
            'operations_supervisor', 'order_status_changed', 'orders',
            '📋 تحديث حالة طلب',
            'تم تحديث حالة الطلب للعميل ' || COALESCE(v_customer_name, 'غير معروف') || ' إلى: ' || v_status_text,
            CASE WHEN NEW.status IN ('cancelled', 'completed') THEN 'high' ELSE 'medium' END,
            'orders', NEW.id, '/orders'
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Notification trigger failed for order status %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_order_status ON orders;
CREATE TRIGGER trigger_notify_order_status
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_order_status_changed();

-- ============================================
-- 3. Trigger لإشعار عند إنشاء مصروف
-- ============================================
CREATE OR REPLACE FUNCTION notify_on_expense_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_worker_name TEXT;
BEGIN
    BEGIN
        SELECT full_name INTO v_worker_name
        FROM users
        WHERE id = NEW.created_by;

        -- إشعار للمدير العام
        PERFORM notify_users_by_role(
            'manager', 'expense_created', 'expenses',
            '💰 مصروف جديد',
            'تم تسجيل مصروف جديد بقيمة ' || NEW.amount || ' ج.م من ' || COALESCE(v_worker_name, 'غير معروف'),
            'medium', 'expenses', NEW.id, '/expenses'
        );

        -- إشعار لمشرف العمليات
        PERFORM notify_users_by_role(
            'operations_supervisor', 'expense_created', 'expenses',
            '💰 مصروف جديد',
            'تم تسجيل مصروف جديد بقيمة ' || NEW.amount || ' ج.م من ' || COALESCE(v_worker_name, 'غير معروف'),
            'low', 'expenses', NEW.id, '/expenses'
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Notification trigger failed for expense %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_expense_created ON expenses;
CREATE TRIGGER trigger_notify_expense_created
    AFTER INSERT ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_expense_created();

-- ============================================
-- 4. Trigger لإشعار عند الموافقة/رفض المصروف
-- ============================================
CREATE OR REPLACE FUNCTION notify_on_expense_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status_text TEXT;
    v_notification_type TEXT;
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    BEGIN
        IF NEW.status = 'approved' THEN
            v_status_text := 'تمت الموافقة على';
            v_notification_type := 'expense_approved';
        ELSIF NEW.status = 'rejected' THEN
            v_status_text := 'تم رفض';
            v_notification_type := 'expense_rejected';
        ELSE
            RETURN NEW;
        END IF;

        IF NEW.created_by IS NOT NULL THEN
            PERFORM create_notification(
                NEW.created_by, v_notification_type, 'expenses',
                CASE WHEN NEW.status = 'approved' THEN '✅ ' ELSE '❌ ' END || v_status_text || ' مصروفك',
                v_status_text || ' المصروف بقيمة ' || NEW.amount || ' ج.م',
                CASE WHEN NEW.status = 'approved' THEN 'medium' ELSE 'high' END,
                'expenses', NEW.id, '/tech/expenses'
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Notification trigger failed for expense status %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_expense_status ON expenses;
CREATE TRIGGER trigger_notify_expense_status
    AFTER UPDATE ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_expense_status_changed();

-- ============================================
-- 5. Trigger لإشعار عند إنشاء مسار جديد
-- ============================================
CREATE OR REPLACE FUNCTION notify_on_route_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_team_name TEXT;
BEGIN
    BEGIN
        SELECT name INTO v_team_name
        FROM teams
        WHERE id = NEW.team_id;

        -- إشعار للمدير العام
        PERFORM notify_users_by_role(
            'manager', 'route_created', 'routes',
            '🚗 مسار جديد',
            'تم إنشاء مسار جديد لفريق: ' || COALESCE(v_team_name, 'غير معروف') || ' بتاريخ ' || TO_CHAR(NEW.date, 'YYYY-MM-DD'),
            'medium', 'routes', NEW.id, '/routes'
        );

        -- إشعار لمشرف العمليات
        PERFORM notify_users_by_role(
            'operations_supervisor', 'route_created', 'routes',
            '🚗 مسار جديد',
            'تم إنشاء مسار جديد لفريق: ' || COALESCE(v_team_name, 'غير معروف') || ' بتاريخ ' || TO_CHAR(NEW.date, 'YYYY-MM-DD'),
            'medium', 'routes', NEW.id, '/routes'
        );

        -- إشعار أعضاء الفريق
        PERFORM notify_team_members_on_route(NEW.id, NEW.team_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Notification trigger failed for route %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_team_members_on_route(p_route_id UUID, p_team_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_worker RECORD;
    v_route_date DATE;
    v_team_name TEXT;
BEGIN
    SELECT r.date, t.name INTO v_route_date, v_team_name
    FROM routes r
    JOIN teams t ON r.team_id = t.id
    WHERE r.id = p_route_id;

    FOR v_worker IN
        SELECT tm.worker_id
        FROM team_members tm
        WHERE tm.team_id = p_team_id
        AND tm.worker_id IS NOT NULL
    LOOP
        BEGIN
            PERFORM create_notification(
                v_worker.worker_id, 'route_assigned', 'routes',
                '📍 تم تعيينك لمسار جديد',
                'تم تعيينك لمسار فريق ' || COALESCE(v_team_name, 'غير معروف') || ' بتاريخ ' || TO_CHAR(v_route_date, 'YYYY-MM-DD'),
                'high', 'routes', p_route_id, '/tech'
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to notify team member %: %', v_worker.worker_id, SQLERRM;
        END;
    END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_route_created ON routes;
CREATE TRIGGER trigger_notify_route_created
    AFTER INSERT ON routes
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_route_created();

-- ============================================
-- 6. Trigger لإشعار عند إضافة عميل جديد
-- ============================================
CREATE OR REPLACE FUNCTION notify_on_customer_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    BEGIN
        -- إشعار للمدير العام
        PERFORM notify_users_by_role(
            'manager', 'customer_created', 'customers',
            '👤 عميل جديد',
            'تم إضافة عميل جديد: ' || NEW.name,
            'low', 'customers', NEW.id, '/customers'
        );

        -- إشعار لمشرف العمليات
        PERFORM notify_users_by_role(
            'operations_supervisor', 'customer_created', 'customers',
            '👤 عميل جديد',
            'تم إضافة عميل جديد: ' || NEW.name,
            'low', 'customers', NEW.id, '/customers'
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Notification trigger failed for customer %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_customer_created ON customers;
CREATE TRIGGER trigger_notify_customer_created
    AFTER INSERT ON customers
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_customer_created();

-- ============================================
-- 7. Trigger لإشعار عند تقديم استبيان
-- جدول customer_surveys
-- ============================================
CREATE OR REPLACE FUNCTION notify_on_survey_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_customer_name TEXT;
    v_rating_text TEXT;
BEGIN
    -- فقط عند تقديم الاستبيان
    IF NEW.submitted_at IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- لا ننفذ إذا كان تحديث وليس تقديم جديد
    IF TG_OP = 'UPDATE' AND OLD.submitted_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    BEGIN
        SELECT c.name INTO v_customer_name
        FROM customers c
        JOIN orders o ON o.customer_id = c.id
        WHERE o.id = NEW.order_id;

        v_rating_text := CASE NEW.overall_rating
            WHEN 5 THEN '⭐⭐⭐⭐⭐ ممتاز'
            WHEN 4 THEN '⭐⭐⭐⭐ جيد جداً'
            WHEN 3 THEN '⭐⭐⭐ جيد'
            WHEN 2 THEN '⭐⭐ مقبول'
            WHEN 1 THEN '⭐ ضعيف'
            ELSE 'غير محدد'
        END;

        -- إشعار للمدير العام
        PERFORM notify_users_by_role(
            'manager', 'survey_submitted', 'customers',
            CASE WHEN COALESCE(NEW.overall_rating, 5) <= 2 THEN '⚠️ تقييم سلبي!' ELSE '📋 استبيان جديد' END,
            'تم استلام استبيان من العميل ' || COALESCE(v_customer_name, 'غير معروف') || ' - التقييم: ' || v_rating_text,
            CASE WHEN COALESCE(NEW.overall_rating, 5) <= 2 THEN 'urgent' ELSE 'medium' END,
            'customers', NEW.id, '/surveys'
        );

        -- إشعار لمشرف العمليات
        PERFORM notify_users_by_role(
            'operations_supervisor', 'survey_submitted', 'customers',
            '📋 استبيان جديد',
            'تم استلام استبيان من العميل ' || COALESCE(v_customer_name, 'غير معروف') || ' - التقييم: ' || v_rating_text,
            CASE WHEN COALESCE(NEW.overall_rating, 5) <= 2 THEN 'urgent' ELSE 'medium' END,
            'customers', NEW.id, '/surveys'
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Notification trigger failed for survey %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_survey_submitted ON customer_surveys;
CREATE TRIGGER trigger_notify_survey_submitted
    AFTER INSERT OR UPDATE OF submitted_at ON customer_surveys
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_survey_submitted();

-- ============================================
-- منح الصلاحيات
-- ============================================
GRANT EXECUTE ON FUNCTION notify_on_order_created TO service_role;
GRANT EXECUTE ON FUNCTION notify_on_order_status_changed TO service_role;
GRANT EXECUTE ON FUNCTION notify_on_expense_created TO service_role;
GRANT EXECUTE ON FUNCTION notify_on_expense_status_changed TO service_role;
GRANT EXECUTE ON FUNCTION notify_on_route_created TO service_role;
GRANT EXECUTE ON FUNCTION notify_team_members_on_route TO service_role;
GRANT EXECUTE ON FUNCTION notify_on_customer_created TO service_role;
GRANT EXECUTE ON FUNCTION notify_on_survey_submitted TO service_role;

-- ============================================
-- 8. Trigger لإرسال Push Notification عبر Edge Function
-- يستخدم pg_net لاستدعاء الـ Edge Function بشكل غير متزامن
-- ============================================

-- تفعيل pg_net extension (مطلوب لاستدعاء HTTP)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- دالة إرسال Push Notification
CREATE OR REPLACE FUNCTION send_push_notification_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_supabase_url TEXT;
    v_service_role_key TEXT;
    v_function_url TEXT;
    v_payload JSONB;
    v_preferences RECORD;
BEGIN
    -- تحقق من تفضيلات المستخدم للإشعارات
    SELECT push_enabled, categories INTO v_preferences
    FROM notification_preferences
    WHERE user_id = NEW.user_id;
    
    -- إذا لم توجد تفضيلات، نفترض أن Push مفعل
    IF NOT FOUND THEN
        v_preferences.push_enabled := true;
        v_preferences.categories := '{"orders": true, "expenses": true, "routes": true, "teams": true, "customers": true, "system": true}'::jsonb;
    END IF;
    
    -- تحقق من تفعيل Push
    IF v_preferences.push_enabled = false THEN
        RETURN NEW;
    END IF;
    
    -- تحقق من تفعيل الفئة
    IF v_preferences.categories IS NOT NULL AND 
       (v_preferences.categories->>NEW.category)::boolean = false THEN
        RETURN NEW;
    END IF;

    BEGIN
        -- القيم المباشرة لـ Supabase (مطلوبة لاستدعاء Edge Function)
        v_supabase_url := 'https://gojvsvkleenaipzirhsm.supabase.co';
        v_service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvanZzdmtsZWVuYWlwemlyaHNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzAyNTYzOSwiZXhwIjoyMDY4NjAxNjM5fQ.dAeWg15D4yy6SEOcp8soM2Bpz7xohW1fv-eFTk1v0Lw';
        
        v_function_url := v_supabase_url || '/functions/v1/send_push_notification';
        
        v_payload := jsonb_build_object(
            'user_id', NEW.user_id,
            'title', NEW.title,
            'message', NEW.message,
            'url', COALESCE(NEW.action_url, '/notifications'),
            'data', jsonb_build_object(
                'notification_id', NEW.id,
                'category', NEW.category,
                'priority', NEW.priority
            )
        );
        
        -- إرسال طلب HTTP غير متزامن عبر pg_net
        PERFORM net.http_post(
            url := v_function_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_service_role_key
            ),
            body := v_payload
        );
        
    EXCEPTION WHEN OTHERS THEN
        -- لا نريد أن يفشل الإشعار بسبب فشل Push
        RAISE WARNING 'Push notification trigger failed: %', SQLERRM;
    END;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_send_push_on_notification ON notifications;
CREATE TRIGGER trigger_send_push_on_notification
    AFTER INSERT ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION send_push_notification_on_insert();

GRANT EXECUTE ON FUNCTION send_push_notification_on_insert TO service_role;

COMMIT;
