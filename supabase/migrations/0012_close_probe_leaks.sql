-- ============================================================================
-- 0012 · Close the leaks found by supabase/rls_probe.sql (2026-11-20)
--
-- Run AFTER 0011. Safe to run more than once.
--
-- 1. Any signed-in user could add THEMSELVES to ANY chat (any chapter) and
--    then read its messages. The policy's second clause also compared
--    me.chat_id = chat_id, which is always true inside the subquery, so an
--    admin of any one chat could add anyone to any chat.
--    The app never inserts chat members directly. Every join goes through a
--    SECURITY DEFINER function that checks permissions (create_group_chat,
--    join_chat_via_invite, add_chat_member_by_username, and the membership
--    trigger). So the client INSERT policy is simply removed.
--
-- 2. Any signed-in user could RSVP to another chapter's event. RSVP writes
--    now also require membership in the event's chapter.
--
-- 3. Everyone at the same school could read every profile's birthday, phone
--    and school email. Profiles stay readable (needed for search, join
--    requests, rosters and chat names), but those three columns are no longer
--    readable through the API. ensure_profile (SECURITY DEFINER) still saves
--    the birthday at onboarding.
-- ============================================================================

-- 1. Chat membership: joins only through permission-checked RPCs
DROP POLICY IF EXISTS chat_members_join ON public.chat_members;

-- 2. RSVPs: only for events in your own chapter
DROP POLICY IF EXISTS rsvps_write_own ON public.event_rsvps;
CREATE POLICY rsvps_write_own ON public.event_rsvps FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.events e
                 WHERE e.id = event_rsvps.event_id AND public.is_org_member(e.org_id))
  );

DROP POLICY IF EXISTS rsvps_update_own ON public.event_rsvps;
CREATE POLICY rsvps_update_own ON public.event_rsvps FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.events e
                 WHERE e.id = event_rsvps.event_id AND public.is_org_member(e.org_id))
  );

-- 3. Profiles: hide birthday, phone and school_email from API reads
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, username, full_name, account_type, edu_verified, is_suspended,
              avatar_url, school_id, created_at, updated_at)
  ON public.profiles TO authenticated;

-- ----------------------------------------------------------------------------
-- Check afterwards: run supabase/rls_probe.sql. Every write_* line should say
-- "blocked" or ok:false, and info_profile_B_private_fields should say blocked.
-- ----------------------------------------------------------------------------
