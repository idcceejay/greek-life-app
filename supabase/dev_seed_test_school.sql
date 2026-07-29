-- ============================================================================
-- DEV ONLY — Test school so a personal Gmail counts as a "student" account.
-- Lets you exercise the full app (map, feed, chapter features) without a .edu.
-- Safe to run more than once. REMOVE BEFORE LAUNCH — see teardown at the bottom.
-- ============================================================================

-- 1. Test school
INSERT INTO public.schools (name, radius_m)
SELECT 'Test University', 8000
WHERE NOT EXISTS (SELECT 1 FROM public.schools WHERE name = 'Test University');

-- 2. Treat these consumer domains as valid campus domains
INSERT INTO public.school_domains (school_id, domain)
SELECT s.id, d
FROM public.schools s,
     unnest(ARRAY['gmail.com', 'outlook.com', 'icloud.com']::citext[]) AS d
WHERE s.name = 'Test University'
ON CONFLICT (domain) DO NOTHING;

-- 3. Upgrade EXISTING accounts that already signed up with those domains.
--    (ensure_profile only runs at onboarding, so accounts created before this
--     seed stay on the alumni tier until we fix them up here.)
WITH test_school AS (
  SELECT id FROM public.schools WHERE name = 'Test University'
),
matching_users AS (
  SELECT p.id AS user_id, u.email::citext AS email, ts.id AS school_id
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  JOIN public.school_domains sd
    ON sd.domain = split_part(u.email, '@', 2)::citext
  JOIN test_school ts ON ts.id = sd.school_id
)
INSERT INTO public.school_affiliations
  (user_id, school_id, school_email, status, verified_at, verification_method)
SELECT user_id, school_id, email, 'current', now(), 'email_otp'
FROM matching_users
ON CONFLICT (user_id, school_id) DO NOTHING;

UPDATE public.profiles p
SET account_type = 'student',
    edu_verified = true,
    school_email = u.email::citext,
    school_id    = sa.school_id
FROM auth.users u
JOIN public.school_affiliations sa ON sa.user_id = u.id AND sa.status = 'current'
JOIN public.schools s ON s.id = sa.school_id AND s.name = 'Test University'
WHERE p.id = u.id;

-- 4. Confirm
SELECT p.username, p.account_type, p.edu_verified, s.name AS school
FROM public.profiles p
LEFT JOIN public.schools s ON s.id = p.school_id;

-- ============================================================================
-- TEARDOWN (run before launch):
--   DELETE FROM public.school_domains
--    WHERE school_id = (SELECT id FROM public.schools WHERE name = 'Test University');
--   DELETE FROM public.school_affiliations
--    WHERE school_id = (SELECT id FROM public.schools WHERE name = 'Test University');
--   UPDATE public.profiles SET account_type = 'alumni', edu_verified = false,
--          school_id = NULL, school_email = NULL
--    WHERE school_id = (SELECT id FROM public.schools WHERE name = 'Test University');
--   DELETE FROM public.schools WHERE name = 'Test University';
-- ============================================================================
