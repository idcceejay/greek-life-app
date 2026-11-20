-- ============================================================================
-- App Review account — promote ONE account to the student tier.
--
-- Why: Rally has no password; Supabase emails an 8-digit code. An App Review
-- reviewer therefore needs a mailbox they can open themselves. That mailbox is
-- a consumer address (outlook.com), which signs up as alumni tier, and the live
-- member map is student-gated — so the reviewer would be locked out of a core
-- feature. This grants that one account the student tier.
--
-- This deliberately does NOT add gmail.com to school_domains. Doing that (as
-- supabase/dev_seed_test_school.sql does) would make EVERY Gmail signup a
-- student. Scope stays at a single user.
--
-- Run AFTER the review mailbox has signed in to Rally at least once, so that
-- auth.users and profiles rows exist. Safe to run more than once.
-- Teardown is at the bottom.
-- ============================================================================

DO $$
DECLARE
  v_email  citext := 'REPLACE_ME@outlook.com';   -- <<< set to the review mailbox
  v_school uuid;
  v_user   uuid;
BEGIN
  SELECT id INTO v_school
    FROM public.schools
   WHERE name = 'Kennesaw State University';

  IF v_school IS NULL THEN
    RAISE EXCEPTION 'School "Kennesaw State University" not found in public.schools';
  END IF;

  SELECT id INTO v_user
    FROM auth.users
   WHERE email::citext = v_email;

  IF v_user IS NULL THEN
    RAISE EXCEPTION
      'No account for %. Sign in once in Rally with that address, then re-run.', v_email;
  END IF;

  INSERT INTO public.school_affiliations
    (user_id, school_id, school_email, status, verified_at, verification_method)
  VALUES
    (v_user, v_school, v_email, 'current', now(), 'email_otp')
  ON CONFLICT (user_id, school_id) DO UPDATE
    SET status      = 'current',
        verified_at = now();

  UPDATE public.profiles
     SET account_type = 'student',
         edu_verified = true,
         school_email = v_email,
         school_id    = v_school
   WHERE id = v_user;

  RAISE NOTICE 'Promoted % to student tier on Kennesaw State University', v_email;
END $$;

-- Confirm (expect account_type = student, edu_verified = true, school set)
SELECT u.email, p.username, p.account_type, p.edu_verified, s.name AS school
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.schools s ON s.id = p.school_id
 WHERE u.email::citext = 'REPLACE_ME@outlook.com';

-- ============================================================================
-- TEARDOWN (run if the review account is ever retired):
--   UPDATE public.profiles SET account_type = 'alumni', edu_verified = false,
--          school_id = NULL, school_email = NULL
--    WHERE id = (SELECT id FROM auth.users WHERE email::citext = 'REPLACE_ME@outlook.com');
--   DELETE FROM public.school_affiliations
--    WHERE user_id = (SELECT id FROM auth.users WHERE email::citext = 'REPLACE_ME@outlook.com');
-- ============================================================================
