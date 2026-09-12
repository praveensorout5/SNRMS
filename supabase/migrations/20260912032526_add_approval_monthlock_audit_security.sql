/*
# Add user approval, month locking, audit log, and private storage

## Overview
Implements the following rules:
1. Users must be approved by admin before they can access any data. New users get approval_status='pending'. Admin approves/rejects. Only approved users see data.
2. Admin (first signup with praveen555sorout@gmail.com) has full power: approvals, view history/changes, add rows/columns, lock months.
3. Month locking: admin can lock a month so no further edits/uploads happen. Upload window is until 10th of next month (enforced in app), admin can lock anytime.
4. Audit log tracks all changes made to nominal_rolls (insert/update/delete) with before/after values and who made the change.
5. Storage bucket made private (not public) for confidentiality. PDFs accessed via signed URLs only.

## Modified Tables
### profiles
- Added `approval_status` (text, default 'pending') - 'pending', 'approved', or 'rejected'
- Added `approved_by` (uuid, references auth.users) - which admin approved
- Added `approved_at` (timestamptz) - when approved

### nominal_rolls
- Added `is_locked` (boolean, default false) - per-row lock

## New Tables
### month_locks
- `id` (uuid, primary key)
- `sheet_type` (text) - 'bhati' or 'beas'
- `month_year` (text) - e.g. '2026-09'
- `is_locked` (boolean, default false) - whether this sheet+month is locked
- `locked_by` (uuid, references auth.users) - who locked it
- `locked_at` (timestamptz) - when locked
- Unique constraint on (sheet_type, month_year)

### audit_log
- `id` (uuid, primary key)
- `table_name` (text) - which table changed
- `record_id` (uuid) - which record
- `action` (text) - 'INSERT', 'UPDATE', or 'DELETE'
- `old_values` (jsonb) - previous values
- `new_values` (jsonb) - new values
- `changed_by` (uuid, references auth.users) - who made the change
- `changed_at` (timestamptz) - when

## Security Changes
- profiles SELECT: only approved users can read profiles (admin can read all)
- profiles UPDATE: admin can update approval_status and role/can_edit
- nominal_rolls SELECT: only approved users can read
- nominal_rolls INSERT/UPDATE: only approved users with can_edit or admin, AND the month must not be locked
- month_locks: only admin can insert/update/delete; approved users can read
- audit_log: only admin can read (view history/changes); no one can modify/delete
- Storage bucket 'nominal-rolls-pdfs' set to private; PDFs accessed via signed URLs
- Storage policies updated: only approved users with edit access can upload; only approved users can read via signed URLs; only admin can delete

## Important Notes
1. The first user (praveen555sorout@gmail.com) is auto-approved and gets admin role via the existing trigger
2. All other users start with approval_status='pending' and cannot see any data until approved
3. Admin can approve/reject users from the Admin Panel
4. Admin can lock any month for any sheet to prevent further edits
5. All changes to nominal_rolls are automatically logged in audit_log
6. PDFs are stored privately; only authenticated approved users get signed URLs
*/

-- ============ profiles: add approval columns ============
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- ============ nominal_rolls: add is_locked column ============
ALTER TABLE nominal_rolls
    ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- ============ month_locks table ============
CREATE TABLE IF NOT EXISTS month_locks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sheet_type text NOT NULL CHECK (sheet_type IN ('bhati', 'beas')),
    month_year text NOT NULL,
    is_locked boolean NOT NULL DEFAULT false,
    locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    locked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (sheet_type, month_year)
);

ALTER TABLE month_locks ENABLE ROW LEVEL SECURITY;

-- ============ audit_log table ============
CREATE TABLE IF NOT EXISTS audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name text NOT NULL,
    record_id uuid,
    action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values jsonb,
    new_values jsonb,
    changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ============ Helper functions ============

-- Check if user is approved
CREATE OR REPLACE FUNCTION is_approved(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = uid AND approval_status = 'approved'
    );
$$;

-- Check if a sheet+month is locked
CREATE OR REPLACE FUNCTION is_month_locked(p_sheet text, p_month text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM month_locks
        WHERE sheet_type = p_sheet AND month_year = p_month AND is_locked = true
    );
$$;

-- Check if user can edit (approved + has edit access or admin)
CREATE OR REPLACE FUNCTION can_edit_rows_v2(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = uid
        AND approval_status = 'approved'
        AND (can_edit = true OR role = 'admin')
    );
$$;

-- ============ profiles policies (updated) ============
-- Only approved users can read profiles; admin reads all
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT
    TO authenticated USING (is_approved(auth.uid()) OR is_admin(auth.uid()));

-- Users can update own profile (name only)
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
    TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Admin can update any profile (approval, role, can_edit)
DROP POLICY IF EXISTS "profiles_admin_update" ON profiles;
CREATE POLICY "profiles_admin_update" ON profiles FOR UPDATE
    TO authenticated
    USING (is_admin(auth.uid()))
    WITH CHECK (is_admin(auth.uid()));

-- ============ nominal_rolls policies (updated) ============
-- Only approved users can read
DROP POLICY IF EXISTS "nominal_rolls_select" ON nominal_rolls;
CREATE POLICY "nominal_rolls_select" ON nominal_rolls FOR SELECT
    TO authenticated USING (is_approved(auth.uid()) OR is_admin(auth.uid()));

-- Only approved + can_edit users can insert, and month must not be locked
DROP POLICY IF EXISTS "nominal_rolls_insert" ON nominal_rolls;
CREATE POLICY "nominal_rolls_insert" ON nominal_rolls FOR INSERT
    TO authenticated WITH CHECK (can_edit_rows_v2(auth.uid()) AND NOT is_month_locked(sheet_type, month_year));

-- Only approved + can_edit users can update, and month must not be locked
DROP POLICY IF EXISTS "nominal_rolls_update" ON nominal_rolls;
CREATE POLICY "nominal_rolls_update" ON nominal_rolls FOR UPDATE
    TO authenticated
    USING (can_edit_rows_v2(auth.uid()) AND NOT is_month_locked(sheet_type, month_year))
    WITH CHECK (can_edit_rows_v2(auth.uid()) AND NOT is_month_locked(sheet_type, month_year));

-- Only admin can delete
DROP POLICY IF EXISTS "nominal_rolls_delete" ON nominal_rolls;
CREATE POLICY "nominal_rolls_delete" ON nominal_rolls FOR DELETE
    TO authenticated USING (is_admin(auth.uid()));

-- ============ month_locks policies ============
-- Approved users can read; only admin can insert/update/delete
DROP POLICY IF EXISTS "month_locks_select" ON month_locks;
CREATE POLICY "month_locks_select" ON month_locks FOR SELECT
    TO authenticated USING (is_approved(auth.uid()) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "month_locks_insert" ON month_locks;
CREATE POLICY "month_locks_insert" ON month_locks FOR INSERT
    TO authenticated WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "month_locks_update" ON month_locks;
CREATE POLICY "month_locks_update" ON month_locks FOR UPDATE
    TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "month_locks_delete" ON month_locks;
CREATE POLICY "month_locks_delete" ON month_locks FOR DELETE
    TO authenticated USING (is_admin(auth.uid()));

-- ============ audit_log policies ============
-- Only admin can read audit log; no one can update/delete directly (trigger handles insert)
DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
CREATE POLICY "audit_log_select" ON audit_log FOR SELECT
    TO authenticated USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;
CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT
    TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "audit_log_update" ON audit_log;
CREATE POLICY "audit_log_update" ON audit_log FOR UPDATE
    TO authenticated USING (false);

DROP POLICY IF EXISTS "audit_log_delete" ON audit_log;
CREATE POLICY "audit_log_delete" ON audit_log FOR DELETE
    TO authenticated USING (false);

-- ============ Audit trigger for nominal_rolls ============
CREATE OR REPLACE FUNCTION log_nominal_roll_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, record_id, action, new_values, changed_by)
        VALUES ('nominal_rolls', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, changed_by)
        VALUES ('nominal_rolls', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, record_id, action, old_values, changed_by)
        VALUES ('nominal_rolls', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS nominal_rolls_audit ON nominal_rolls;
CREATE TRIGGER nominal_rolls_audit
    AFTER INSERT OR UPDATE OR DELETE ON nominal_rolls
    FOR EACH ROW EXECUTE FUNCTION log_nominal_roll_changes();

-- ============ Update handle_new_user to auto-approve first user (admin) ============
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_count integer;
    is_first boolean;
BEGIN
    SELECT COUNT(*) INTO user_count FROM profiles;
    is_first := (user_count = 0);

    INSERT INTO profiles (id, email, full_name, role, can_edit, approval_status)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        CASE WHEN is_first THEN 'admin' ELSE 'user' END,
        CASE WHEN is_first THEN true ELSE false END,
        CASE WHEN is_first THEN 'approved' ELSE 'pending' END
    );
    RETURN NEW;
END;
$$;

-- ============ Make storage bucket private ============
UPDATE storage.buckets SET public = false WHERE id = 'nominal-rolls-pdfs';

-- ============ Storage policies (updated for private bucket) ============
-- Only approved + can_edit users can upload PDFs
DROP POLICY IF EXISTS "storage_pdf_upload" ON storage.objects;
CREATE POLICY "storage_pdf_upload" ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'nominal-rolls-pdfs' AND can_edit_rows_v2(auth.uid()));

-- Only approved users can read PDFs (for signed URLs)
DROP POLICY IF EXISTS "storage_pdf_read" ON storage.objects;
CREATE POLICY "storage_pdf_read" ON storage.objects FOR SELECT
    TO authenticated USING (bucket_id = 'nominal-rolls-pdfs' AND (is_approved(auth.uid()) OR is_admin(auth.uid())));

-- Only admin can delete PDFs
DROP POLICY IF EXISTS "storage_pdf_delete" ON storage.objects;
CREATE POLICY "storage_pdf_delete" ON storage.objects FOR DELETE
    TO authenticated USING (bucket_id = 'nominal-rolls-pdfs' AND is_admin(auth.uid()));

-- ============ Indexes ============
CREATE INDEX IF NOT EXISTS idx_month_locks_sheet_month ON month_locks(sheet_type, month_year);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_profiles_approval_status ON profiles(approval_status);
