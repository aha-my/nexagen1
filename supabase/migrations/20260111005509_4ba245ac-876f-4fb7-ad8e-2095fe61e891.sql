-- Drop the overly permissive SELECT policy on profiles
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

-- Create a more secure SELECT policy that only allows viewing:
-- 1. Your own profile
-- 2. Profiles of users you have an accepted friendship with
CREATE POLICY "Users can view their own profile and friends profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
    AND (
      (requester_id = auth.uid() AND addressee_id = profiles.user_id)
      OR (addressee_id = auth.uid() AND requester_id = profiles.user_id)
    )
  )
);

-- Add DELETE policy for conversations so users can remove their conversation history
CREATE POLICY "Users can delete their conversations"
ON public.conversations
FOR DELETE
USING (auth.uid() = participant1_id OR auth.uid() = participant2_id);