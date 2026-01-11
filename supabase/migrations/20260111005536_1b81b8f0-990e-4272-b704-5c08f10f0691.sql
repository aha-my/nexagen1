-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view relevant profiles" ON public.profiles;

-- Create a security definer function to search profiles by username
-- This allows searching without exposing all data
CREATE OR REPLACE FUNCTION public.search_profiles_by_username(search_query text, exclude_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  bio text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    p.username,
    p.avatar_url,
    p.bio
  FROM public.profiles p
  WHERE p.username ILIKE '%' || search_query || '%'
  AND p.user_id != exclude_user_id
  LIMIT 10;
END;
$$;

-- Create policy that allows:
-- 1. Your own profile (full access)
-- 2. Profiles of friends/pending friends (for chat lists and notifications)
CREATE POLICY "Users can view their own profile and connected profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM public.friendships
    WHERE (
      (requester_id = auth.uid() AND addressee_id = profiles.user_id)
      OR (addressee_id = auth.uid() AND requester_id = profiles.user_id)
    )
  )
);