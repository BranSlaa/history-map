-- Fix profiles table RLS policies

-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Service role can do all" ON profiles;

-- Create policy for users to insert their own profiles
CREATE POLICY "Users can insert their own profile" 
ON profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Create policy for service role to have full access
CREATE POLICY "Service role can do all" 
ON profiles
USING (true);

-- Verify policies
SELECT policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies
WHERE tablename = 'profiles'; 