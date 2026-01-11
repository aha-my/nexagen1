-- Drop the current policy and create a more flexible one
DROP POLICY IF EXISTS "Users can view their own profile and friends profiles" ON public.profiles;

-- Create policy that allows:
-- 1. Your own profile
-- 2. Profiles of accepted friends
-- 3. Profiles during friend search (pending friendships - so you can see who you're adding)
CREATE POLICY "Users can view relevant profiles"
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