-- ============================================================================
-- 0011 · Lock down who can call database functions
--
-- WHY (found 2026-11-20, UNFORGET A10):
--   Postgres lets EVERYONE (the PUBLIC role) run a new function unless told
--   otherwise, and Supabase also grants the signed-out "anon" role. So every
--   RPC in 0001-0010 could be called with only the publishable app key.
--
--   Two of them had no permission check at all because they were meant only
--   for the Stripe webhook (which uses the service_role key):
--     * record_stripe_payment: any signed-in member could mark their own
--       dues charge as paid.
--     * set_stripe_account: anyone could point a chapter's Stripe payouts at
--       their own Stripe account once Stripe goes live.
--
-- WHAT THIS DOES:
--   1. Server-only functions: callable by service_role only.
--   2. Every other Rally function in the public schema: no longer callable by
--      PUBLIC or anon. Signed-in users ("authenticated") keep their explicit
--      grant, so the app works exactly as before. Rally never calls an RPC
--      before sign-in.
--   3. Trigger functions: nobody needs to call these directly. Triggers fire
--      without EXECUTE permission (the same pattern 0007 used for
--      tg_reports_stamp_resolution).
--   4. Pins search_path on the 9 trigger functions the Supabase advisor
--      flagged, so a malicious search_path can't hijack them.
--   5. Future functions created in public no longer default to PUBLIC/anon.
--
-- PostGIS functions (owned by the extension) are left alone.
-- Safe to run more than once.
-- ============================================================================

-- 1. Server-only (Stripe webhook / edge functions via service_role)
REVOKE EXECUTE ON FUNCTION public.record_stripe_payment(
  uuid, text, integer, integer, integer, public.payment_channel
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_stripe_payment(
  uuid, text, integer, integer, integer, public.payment_channel
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.set_stripe_account(
  uuid, text, public.payment_account_status
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_stripe_account(
  uuid, text, public.payment_account_status
) TO service_role;

-- 2 + 3. Every Rally-owned function in public (skips extension functions).
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig,
           p.prorettype = 'trigger'::regtype AS is_trigger
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prokind = 'f'
       AND NOT EXISTS (
             SELECT 1 FROM pg_depend d
              WHERE d.objid = p.oid AND d.deptype = 'e'
           )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    IF f.is_trigger THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', f.sig);
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;

-- Re-assert the two server-only functions after the loop (the loop only
-- revokes from PUBLIC/anon, so authenticated stays revoked from step 1).
REVOKE EXECUTE ON FUNCTION public.record_stripe_payment(
  uuid, text, integer, integer, integer, public.payment_channel
) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_stripe_account(
  uuid, text, public.payment_account_status
) FROM authenticated;

-- 4. Fixed search_path on trigger functions (Supabase advisor lint 0011)
ALTER FUNCTION public.tg_set_updated_at()            SET search_path = public;
ALTER FUNCTION public.tg_check_affiliation_domain()  SET search_path = public;
ALTER FUNCTION public.tg_check_alumni_not_admin()    SET search_path = public;
ALTER FUNCTION public.tg_apply_post_vote()           SET search_path = public;
ALTER FUNCTION public.tg_apply_comment_vote()        SET search_path = public;
ALTER FUNCTION public.tg_poll_single_select()        SET search_path = public;
ALTER FUNCTION public.tg_charges_route()             SET search_path = public;
ALTER FUNCTION public.tg_payments_guard()            SET search_path = public;
ALTER FUNCTION public.tg_settle_charge()             SET search_path = public;

-- 5. Future functions: no automatic PUBLIC/anon execute. authenticated and
--    service_role keep Supabase's default grants, so new RPCs still work for
--    signed-in users; server-only ones must REVOKE from authenticated.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

-- ----------------------------------------------------------------------------
-- Check afterwards (optional, read-only). Both rows should say false/false:
--   SELECT proname,
--          has_function_privilege('anon', oid, 'EXECUTE')          AS anon,
--          has_function_privilege('authenticated', oid, 'EXECUTE') AS signed_in
--     FROM pg_proc
--    WHERE proname IN ('record_stripe_payment', 'set_stripe_account');
-- ----------------------------------------------------------------------------
