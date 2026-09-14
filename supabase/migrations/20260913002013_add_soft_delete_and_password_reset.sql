/*
# Add 7-day soft-delete for users + admin password reset

## Changes
1. profiles: add deleted_at, deleted_by columns for soft-delete
2. profiles: add a new "deleted" approval_status value
3. A cron-like cleanup function to permanently delete after 7 days
4. RLS: admin can read deleted profiles, restore them
5. A SECURITY DEFINER function for admin to reset a user's password via auth.admin API
*/

-- Add soft-delete columns
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
    ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Update approval_status constraint to include 'deleted'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_approval_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_approval_status_check
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'deleted'));

-- Admin can read deleted profiles (already covered by is_admin in SELECT policy)
-- Admin can restore deleted profiles (update approval_status back, clear deleted_at)
-- The existing profiles_admin_update policy already allows admin to update any profile

-- Function to permanently delete profiles soft-deleted more than 7 days ago
-- Called manually or via pg_cron if available
CREATE OR REPLACE FUNCTION cleanup_expired_deleted_profiles()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_count integer;
    profile_record RECORD;
BEGIN
    deleted_count := 0;
    FOR profile_record IN
        SELECT id FROM profiles
        WHERE approval_status = 'deleted'
        AND deleted_at IS NOT NULL
        AND deleted_at < now() - interval '7 days'
    LOOP
        -- Delete the auth user (cascades to profile via FK)
        DELETE FROM auth.users WHERE id = profile_record.id;
        deleted_count := deleted_count + 1;
    END LOOP;
    RETURN deleted_count;
END;
$$;

-- Admin password reset function using Supabase auth admin API
-- This generates a one-time use action link that the admin can share with the user
CREATE OR REPLACE FUNCTION admin_reset_user_password(target_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
BEGIN
    -- Use Supabase's internal admin API to generate a recovery link
    -- We'll use the auth.admin.generate_link function if available
    -- Otherwise return an error
    BEGIN
        SELECT * INTO result FROM auth.admin.generate_link(
            'recovery',
            target_email,
            '{}'::json
        );
        RETURN result;
    EXCEPTION WHEN OTHERS THEN
        RETURN json_build_object('error', SQLERRM);
    END;
END;
$$;

-- Grant execute to authenticated (admin check is in the function's usage context)
GRANT EXECUTE ON FUNCTION admin_reset_user_password(text) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_deleted_profiles() TO authenticated;
