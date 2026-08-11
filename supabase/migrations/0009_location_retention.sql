-- ============================================================================
-- Rally - 0009_location_retention.sql
-- 90-day retention for location pings.
--
-- Replaces the commented-out block at the end of 0003_rls.sql. Location data on
-- students is the app's highest-sensitivity dataset; this enforces the retention
-- promise made in the privacy policy and on the launch security checklist.
--
-- Safe to run more than once.
--
-- STATUS: APPLIED to the hosted project 08/11/2026. Verified: cron.job jobid 1,
-- schedule 15 3 * * *, active = true; idx_locations_captured_at present.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Scheduling engine
-- ----------------------------------------------------------------------------
-- pg_cron creates the `cron` schema and the cron.job table. Supabase ships it
-- but leaves it off by default.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ----------------------------------------------------------------------------
-- 2. Index for the purge predicate
-- ----------------------------------------------------------------------------
-- The existing idx_locations_user_captured is (user_id, captured_at DESC). The
-- purge filters on captured_at alone, which cannot use that index's leading
-- column, so without this the nightly delete performs a full table scan.
CREATE INDEX IF NOT EXISTS idx_locations_captured_at
  ON public.locations (captured_at);

-- ----------------------------------------------------------------------------
-- 3. Nightly purge, scheduled idempotently
-- ----------------------------------------------------------------------------
-- Unschedule first so re-running this file cannot stack duplicate jobs.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-old-locations') THEN
    PERFORM cron.unschedule('purge-old-locations');
  END IF;

  PERFORM cron.schedule(
    'purge-old-locations',
    '15 3 * * *',   -- 03:15 UTC every night
    $job$DELETE FROM public.locations WHERE captured_at < now() - interval '90 days'$job$
  );
END
$do$;

-- ----------------------------------------------------------------------------
-- 4. Verification (run this after applying)
-- ----------------------------------------------------------------------------
-- SELECT jobid, jobname, schedule, active FROM cron.job
--  WHERE jobname = 'purge-old-locations';
--
-- Job run history, after it has fired at least once:
-- SELECT status, return_message, start_time, end_time
--   FROM cron.job_run_details
--  WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'purge-old-locations')
--  ORDER BY start_time DESC LIMIT 5;
