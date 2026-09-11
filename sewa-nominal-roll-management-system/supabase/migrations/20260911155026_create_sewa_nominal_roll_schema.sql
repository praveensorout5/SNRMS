/*
# Sewa Nominal Roll Management System - Database Schema

## Overview
Creates the complete schema for the Sewa Nominal Roll Management System, including user profiles with role-based access, nominal roll entries for two sheets (Bhati & Beas), and PDF storage for signed nominal rolls.

## New Tables

### profiles
- `id` (uuid, primary key, references auth.users) - links to Supabase auth
- `email` (text, unique, not null) - user's email
- `full_name` (text) - user's display name
- `role` (text, default 'user') - 'admin' or 'user'
- `can_edit` (boolean, default false) - whether user can add/edit rows (controlled by admin)
- `created_at` (timestamptz) - registration timestamp

### nominal_rolls
- `id` (uuid, primary key) - unique row ID
- `sheet_type` (text, not null) - 'bhati' or 'beas'
- `s_no` (integer) - serial number
- `sewa_from_date` (date) - sewa start date
- `sewa_to_date` (date) - sewa end date
- `department` (text) - department name
- `center` (text) - center name
- `no_of_sewadars` (integer) - number of sewadars
- `pdf_path` (text) - storage path for uploaded PDF
- `pdf_name` (text) - original PDF filename
- `month_year` (text, not null) - e.g. '2026-09' for grouping by month
- `created_by` (uuid, references auth.users) - who created the row
- `created_at` (timestamptz) - creation timestamp
- `updated_at` (timestamptz) - last update timestamp

## Security
- RLS enabled on both tables
- profiles: users can read all profiles, users can update their own profile, admin can update all profiles
- nominal_rolls: all authenticated users can read, users with edit access can insert/update, admin can delete
- Storage bucket 'nominal-rolls-pdfs' created for PDF uploads

## Important Notes
1. The first user to register is automatically assigned the 'admin' role via a trigger
2. All authenticated users can view nominal roll data
3. Only users with can_edit=true or admin role can add/edit rows
4. Only admin can delete rows
5. PDF files are stored in Supabase Storage bucket 'nominal-rolls-pdfs'
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text UNIQUE NOT NULL,
    full_name text DEFAULT '',
    role text NOT NULL DEFAULT 'user',
    can_edit boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT
    TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
    TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Admin can update any profile (for toggling edit access)
CREATE OR REPLACE FUNCTION is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = uid AND role = 'admin'
    );
$$;

DROP POLICY IF EXISTS "profiles_admin_update" ON profiles;
CREATE POLICY "profiles_admin_update" ON profiles FOR UPDATE
    TO authenticated
    USING (is_admin(auth.uid()))
    WITH CHECK (is_admin(auth.uid()));

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO profiles (id, email, full_name, role, can_edit)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        CASE WHEN (SELECT COUNT(*) FROM profiles) = 0 THEN 'admin' ELSE 'user' END,
        CASE WHEN (SELECT COUNT(*) FROM profiles) = 0 THEN true ELSE false END
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create nominal_rolls table
CREATE TABLE IF NOT EXISTS nominal_rolls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sheet_type text NOT NULL CHECK (sheet_type IN ('bhati', 'beas')),
    s_no integer,
    sewa_from_date date,
    sewa_to_date date,
    department text DEFAULT '',
    center text DEFAULT '',
    no_of_sewadars integer DEFAULT 0,
    pdf_path text,
    pdf_name text,
    month_year text NOT NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nominal_rolls ENABLE ROW LEVEL SECURITY;

-- Users with edit access or admin can insert/update
CREATE OR REPLACE FUNCTION can_edit_rows(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = uid AND (can_edit = true OR role = 'admin')
    );
$$;

-- Nominal rolls policies
DROP POLICY IF EXISTS "nominal_rolls_select" ON nominal_rolls;
CREATE POLICY "nominal_rolls_select" ON nominal_rolls FOR SELECT
    TO authenticated USING (true);

DROP POLICY IF EXISTS "nominal_rolls_insert" ON nominal_rolls;
CREATE POLICY "nominal_rolls_insert" ON nominal_rolls FOR INSERT
    TO authenticated WITH CHECK (can_edit_rows(auth.uid()));

DROP POLICY IF EXISTS "nominal_rolls_update" ON nominal_rolls;
CREATE POLICY "nominal_rolls_update" ON nominal_rolls FOR UPDATE
    TO authenticated
    USING (can_edit_rows(auth.uid()))
    WITH CHECK (can_edit_rows(auth.uid()));

DROP POLICY IF EXISTS "nominal_rolls_delete" ON nominal_rolls;
CREATE POLICY "nominal_rolls_delete" ON nominal_rolls FOR DELETE
    TO authenticated USING (is_admin(auth.uid()));

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nominal_rolls_updated_at ON nominal_rolls;
CREATE TRIGGER nominal_rolls_updated_at
    BEFORE UPDATE ON nominal_rolls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_nominal_rolls_sheet_month ON nominal_rolls(sheet_type, month_year);
CREATE INDEX IF NOT EXISTS idx_nominal_rolls_created_by ON nominal_rolls(created_by);

-- Create storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('nominal-rolls-pdfs', 'nominal-rolls-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for PDF uploads
DROP POLICY IF EXISTS "storage_pdf_upload" ON storage.objects;
CREATE POLICY "storage_pdf_upload" ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'nominal-rolls-pdfs' AND can_edit_rows(auth.uid()));

DROP POLICY IF EXISTS "storage_pdf_read" ON storage.objects;
CREATE POLICY "storage_pdf_read" ON storage.objects FOR SELECT
    TO authenticated USING (bucket_id = 'nominal-rolls-pdfs');

DROP POLICY IF EXISTS "storage_pdf_delete" ON storage.objects;
CREATE POLICY "storage_pdf_delete" ON storage.objects FOR DELETE
    TO authenticated USING (bucket_id = 'nominal-rolls-pdfs' AND is_admin(auth.uid()));
