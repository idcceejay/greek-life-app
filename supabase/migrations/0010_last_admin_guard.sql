-- ============================================================================
-- Rally - 0010_last_admin_guard.sql
--
-- Prevents an organization from losing its final active admin.
--
-- Why: memberships_admin_update (0003_rls.sql) lets any admin change any row in
-- their org, including their own. An admin who demotes or removes themselves
-- while being the only admin leaves is_org_admin() false for everyone in that
-- org forever. Nothing in the app can then approve a pending join request,
-- change a role, or remove a member. There is no recovery path short of manual
-- SQL, so this is enforced in the database rather than the UI.
--
-- Cascades are deliberately exempt. delete_my_account() (0007) already hands
-- sole-admin orgs to another active member before deleting, and deleting an
-- organization should not be blocked by its own membership rows. Both cases are
-- detected by checking whether the parent row still exists - during a cascade
-- the parent is already gone by the time the child trigger fires.
--
-- Safe to run more than once.
--
-- STATUS: APPLIED 08/11/2026. Verified by rolled-back transaction test against the
-- live org: demoting the last active admin -> blocked; deleting the last active
-- admin -> blocked. Membership counts unchanged after the test (2 active admins,
-- 1 pending, 4 total).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tg_protect_last_admin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_remaining int;
BEGIN
  -- Only act when the row being changed is currently an ACTIVE ADMIN.
  IF NOT (OLD.role = 'admin' AND OLD.status = 'active') THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- On UPDATE, allow anything that leaves them still an active admin
  -- (for example an unrelated column change).
  IF TG_OP = 'UPDATE' AND NEW.role = 'admin' AND NEW.status = 'active' THEN
    RETURN NEW;
  END IF;

  -- Cascade exemption: organization already deleted.
  IF NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = OLD.org_id) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- Cascade exemption: profile already deleted (account deletion).
  IF NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = OLD.user_id) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- Is anyone else still an active admin of this org?
  SELECT count(*) INTO v_remaining
    FROM memberships m
   WHERE m.org_id  = OLD.org_id
     AND m.user_id <> OLD.user_id
     AND m.role    = 'admin'
     AND m.status  = 'active';

  IF v_remaining = 0 THEN
    RAISE EXCEPTION
      'This is the only admin of the organization. Promote another member to admin before removing or changing this one.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

DROP TRIGGER IF EXISTS trg_protect_last_admin ON public.memberships;
CREATE TRIGGER trg_protect_last_admin
  BEFORE UPDATE OR DELETE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.tg_protect_last_admin();

-- ----------------------------------------------------------------------------
-- Verification (run after applying)
-- ----------------------------------------------------------------------------
-- SELECT tgname, tgenabled FROM pg_trigger
--  WHERE tgrelid = 'public.memberships'::regclass AND NOT tgisinternal;
