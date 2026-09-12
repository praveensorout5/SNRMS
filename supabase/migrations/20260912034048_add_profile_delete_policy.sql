/*
# Add DELETE policy on profiles for admin

Allows the admin to delete user profiles, which revokes their access entirely.
A deleted user who tries to log in again will see an "account removed" message.

## Security
- Only admin can delete profiles (is_admin check)
- Users cannot delete their own or others' profiles
*/

DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE
    TO authenticated USING (is_admin(auth.uid()));
