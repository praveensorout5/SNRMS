/*
# Allow admin to bypass month lock

Admin has full power and can edit even locked months. Update nominal_rolls
INSERT/UPDATE policies to allow admin to bypass the month lock check.
*/

-- Updated insert: admin bypasses lock
DROP POLICY IF EXISTS "nominal_rolls_insert" ON nominal_rolls;
CREATE POLICY "nominal_rolls_insert" ON nominal_rolls FOR INSERT
    TO authenticated WITH CHECK (
        can_edit_rows_v2(auth.uid())
        AND (is_admin(auth.uid()) OR NOT is_month_locked(sheet_type, month_year))
    );

-- Updated update: admin bypasses lock
DROP POLICY IF EXISTS "nominal_rolls_update" ON nominal_rolls;
CREATE POLICY "nominal_rolls_update" ON nominal_rolls FOR UPDATE
    TO authenticated
    USING (
        can_edit_rows_v2(auth.uid())
        AND (is_admin(auth.uid()) OR NOT is_month_locked(sheet_type, month_year))
    )
    WITH CHECK (
        can_edit_rows_v2(auth.uid())
        AND (is_admin(auth.uid()) OR NOT is_month_locked(sheet_type, month_year))
    );
