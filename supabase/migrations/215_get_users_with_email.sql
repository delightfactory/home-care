-- =============================================
-- Migration 215: Admin-only RPCs to fetch user emails
-- Purpose: Expose email from auth.users for admin review
-- Impact: ADDITIVE ONLY — no changes to existing tables/functions
-- =============================================

-- Drop existing functions if they exist (safe re-run)
DROP FUNCTION IF EXISTS get_users_with_email();
DROP FUNCTION IF EXISTS get_user_email(UUID);

-- 1) get_users_with_email: Returns all users with their email & role data
-- Used by: Roles page → Users tab
CREATE OR REPLACE FUNCTION get_users_with_email()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_result JSON;
  v_is_admin BOOLEAN := false;
BEGIN
  -- Check admin permission (flexible check)
  SELECT EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = auth.uid()
    AND (
      r.name = 'manager'
      OR (r.permissions->>'admin')::boolean = true
    )
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    -- Return empty array instead of raising exception (graceful fallback)
    RETURN '[]'::JSON;
  END IF;

  SELECT json_agg(row_to_json(t))
  INTO v_result
  FROM (
    SELECT
      u.id,
      COALESCE(au.email, '') AS email,
      u.full_name,
      u.phone,
      u.is_active,
      u.role_id,
      r.name AS role_name,
      r.name_ar AS role_name_ar,
      r.permissions AS role_permissions,
      r.is_active AS role_is_active,
      u.created_at,
      u.updated_at
    FROM users u
    LEFT JOIN auth.users au ON au.id = u.id
    LEFT JOIN roles r ON r.id = u.role_id
    ORDER BY u.full_name
  ) t;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

-- 2) get_user_email: Returns email for a single user by ID
-- Used by: Worker edit modal to display linked user's email
CREATE OR REPLACE FUNCTION get_user_email(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT;
  v_is_admin BOOLEAN := false;
BEGIN
  -- Check admin permission (flexible check)
  SELECT EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = auth.uid()
    AND (
      r.name = 'manager'
      OR (r.permissions->>'admin')::boolean = true
    )
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN '';
  END IF;

  SELECT au.email INTO v_email
  FROM auth.users au
  WHERE au.id = p_user_id;

  RETURN COALESCE(v_email, '');
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_users_with_email() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_email(UUID) TO authenticated;

-- Force PostgREST to reload schema cache (picks up new functions)
NOTIFY pgrst, 'reload schema';
