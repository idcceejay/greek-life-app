-- ============================================================================
-- Greek Life App — 0003_rls.sql
-- Row Level Security: implements the "Access & role rules" section of the ERD
-- reference (v6 §rules + v7 additions) as enforceable policy.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so they can read across RLS)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_student() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.account_type = 'student' AND NOT p.is_suspended
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND NOT p.is_suspended);
$$;

CREATE OR REPLACE FUNCTION public.current_school_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT school_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(p_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.org_id = p_org AND m.user_id = auth.uid() AND m.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.org_id = p_org AND m.user_id = auth.uid()
      AND m.status = 'active' AND m.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin_or_treasurer(p_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.org_id = p_org AND m.user_id = auth.uid()
      AND m.status = 'active' AND m.role IN ('admin', 'treasurer')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_chat_member(p_chat uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_members cm WHERE cm.chat_id = p_chat AND cm.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.shares_active_org_with(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM memberships a
    JOIN memberships b ON b.org_id = a.org_id
    WHERE a.user_id = auth.uid() AND a.status = 'active'
      AND b.user_id = p_user AND b.status = 'active'
  );
$$;

-- ----------------------------------------------------------------------------
-- Enable RLS everywhere
-- ----------------------------------------------------------------------------
ALTER TABLE public.schools               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_domains        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_affiliations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_exceptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_feeds        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_votes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_votes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_prefs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dues_cycles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charges               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_plans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_fees         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_events ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Reference data
-- ----------------------------------------------------------------------------
CREATE POLICY schools_read ON public.schools FOR SELECT TO authenticated USING (true);
CREATE POLICY school_domains_read ON public.school_domains FOR SELECT TO authenticated USING (true);
-- Writes to schools/school_domains: service_role only (no policies → denied).

-- ----------------------------------------------------------------------------
-- Profiles & affiliations
-- ----------------------------------------------------------------------------
CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR shares_active_org_with(id) OR school_id = current_school_id());
CREATE POLICY profiles_insert_self ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  -- account_type / edu_verified / is_suspended / school_id changes happen via
  -- SECURITY DEFINER verification RPCs, not direct updates:
  WITH CHECK (id = auth.uid());

CREATE POLICY affiliations_read_own ON public.school_affiliations FOR SELECT TO authenticated
  USING (user_id = auth.uid());
-- Inserts/updates via verification RPC (service role) only.

-- ----------------------------------------------------------------------------
-- Organizations & membership
-- ----------------------------------------------------------------------------
CREATE POLICY orgs_read_campus ON public.organizations FOR SELECT TO authenticated
  USING (school_id = current_school_id() OR is_org_member(id));
CREATE POLICY orgs_create_students ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (is_student() AND created_by = auth.uid());
CREATE POLICY orgs_update_admin ON public.organizations FOR UPDATE TO authenticated
  USING (is_org_admin(id)) WITH CHECK (is_org_admin(id));

-- Members see the roster; admins manage it.
CREATE POLICY memberships_read ON public.memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_org_member(org_id));
-- Students may self-request (pending, role user). Alumni may not self-insert.
CREATE POLICY memberships_self_request ON public.memberships FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND status = 'pending' AND role = 'user' AND is_student()
  );
-- Admins approve/change roles; self-promotion blocked by requiring admin on UPDATE.
CREATE POLICY memberships_admin_update ON public.memberships FOR UPDATE TO authenticated
  USING (is_org_admin(org_id)) WITH CHECK (is_org_admin(org_id));
CREATE POLICY memberships_admin_delete ON public.memberships FOR DELETE TO authenticated
  USING (is_org_admin(org_id) OR user_id = auth.uid());  -- admins remove; users may leave

CREATE POLICY invitations_admin_all ON public.invitations FOR ALL TO authenticated
  USING (is_org_admin(org_id)) WITH CHECK (is_org_admin(org_id) AND invited_by = auth.uid());
CREATE POLICY invitations_read_own ON public.invitations FOR SELECT TO authenticated
  USING (invited_user_id = auth.uid());
-- Invite acceptance runs through a SECURITY DEFINER RPC (accept_invitation(token)).

-- ----------------------------------------------------------------------------
-- Calendar (students full; alumni keep calendar access — v6 matrix)
-- ----------------------------------------------------------------------------
CREATE POLICY events_read ON public.events FOR SELECT TO authenticated
  USING (
    is_org_member(org_id)
    OR (visibility = 'public' AND EXISTS (
          SELECT 1 FROM public.organizations o
          WHERE o.id = org_id AND o.school_id = current_school_id()))
  );
CREATE POLICY events_write_member ON public.events FOR INSERT TO authenticated
  WITH CHECK (is_org_member(org_id) AND created_by = auth.uid());
CREATE POLICY events_update ON public.events FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR is_org_admin(org_id))
  WITH CHECK (created_by = auth.uid() OR is_org_admin(org_id));
CREATE POLICY events_delete ON public.events FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR is_org_admin(org_id));

CREATE POLICY event_exceptions_rw ON public.event_exceptions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e
                 WHERE e.id = event_id AND (e.created_by = auth.uid() OR is_org_admin(e.org_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e
                 WHERE e.id = event_id AND (e.created_by = auth.uid() OR is_org_admin(e.org_id))));

CREATE POLICY rsvps_read ON public.event_rsvps FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND is_org_member(e.org_id)));
CREATE POLICY rsvps_write_own ON public.event_rsvps FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY rsvps_update_own ON public.event_rsvps FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY rsvps_delete_own ON public.event_rsvps FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY calendar_feeds_own ON public.calendar_feeds FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Chat (alumni keep messaging access — v6 matrix)
-- ----------------------------------------------------------------------------
CREATE POLICY chats_read_member ON public.chats FOR SELECT TO authenticated
  USING (is_chat_member(id));
CREATE POLICY chats_create ON public.chats FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (org_id IS NULL OR is_org_member(org_id)));

CREATE POLICY chat_members_read ON public.chat_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_chat_member(chat_id));
CREATE POLICY chat_members_join ON public.chat_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.chat_members me
               WHERE me.chat_id = chat_id AND me.user_id = auth.uid() AND me.role = 'admin')
  );
CREATE POLICY chat_members_update_own ON public.chat_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY chat_members_leave ON public.chat_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY messages_read ON public.messages FOR SELECT TO authenticated
  USING (is_chat_member(chat_id)
         AND NOT EXISTS (SELECT 1 FROM public.user_blocks b
                         WHERE b.blocker_id = auth.uid() AND b.blocked_id = sender_id));
CREATE POLICY messages_send ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND is_chat_member(chat_id) AND is_active());
CREATE POLICY messages_edit_own ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());

CREATE POLICY reactions_rw ON public.message_reactions FOR ALL TO authenticated
  USING (user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.messages m
                    WHERE m.id = message_id AND is_chat_member(m.chat_id)))
  WITH CHECK (user_id = auth.uid()
              AND EXISTS (SELECT 1 FROM public.messages m
                          WHERE m.id = message_id AND is_chat_member(m.chat_id)));

-- ----------------------------------------------------------------------------
-- Location (students only; append-only pings; respect sharing toggles)
-- ----------------------------------------------------------------------------
CREATE POLICY locset_own ON public.location_settings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY locations_insert_own ON public.locations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_student());
CREATE POLICY locations_read ON public.locations FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      is_student()
      AND shares_active_org_with(user_id)
      AND EXISTS (SELECT 1 FROM public.location_settings ls
                  WHERE ls.user_id = locations.user_id
                    AND ls.sharing_enabled AND NOT ls.ghost_mode)
    )
  );
-- No UPDATE/DELETE policies: pings are immutable; retention handled by pg_cron.

-- ----------------------------------------------------------------------------
-- Social feed (students only — v6 matrix; blocks respected)
-- ----------------------------------------------------------------------------
CREATE POLICY posts_read_students ON public.posts FOR SELECT TO authenticated
  USING (
    is_student() AND deleted_at IS NULL
    AND ((scope = 'campus' AND school_id = current_school_id())
      OR (scope = 'chapter' AND is_org_member(org_id)))
    AND NOT EXISTS (SELECT 1 FROM public.user_blocks b
                    WHERE b.blocker_id = auth.uid() AND b.blocked_id = author_id)
  );
CREATE POLICY posts_insert_students ON public.posts FOR INSERT TO authenticated
  WITH CHECK (
    is_student() AND author_id = auth.uid()
    AND ((scope = 'campus' AND school_id = current_school_id())
      OR (scope = 'chapter' AND is_org_member(org_id)))
  );
CREATE POLICY posts_soft_delete_own ON public.posts FOR UPDATE TO authenticated
  USING (author_id = auth.uid()
         OR (scope = 'chapter' AND is_org_admin(org_id)))
  WITH CHECK (author_id = auth.uid()
         OR (scope = 'chapter' AND is_org_admin(org_id)));

CREATE POLICY post_votes_rw ON public.post_votes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND is_student());

CREATE POLICY comments_read ON public.comments FOR SELECT TO authenticated
  USING (is_student() AND deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id));
CREATE POLICY comments_insert ON public.comments FOR INSERT TO authenticated
  WITH CHECK (is_student() AND author_id = auth.uid());
CREATE POLICY comments_update_own ON public.comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

CREATE POLICY comment_votes_rw ON public.comment_votes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND is_student());

-- ----------------------------------------------------------------------------
-- Polls
-- ----------------------------------------------------------------------------
CREATE POLICY polls_read ON public.polls FOR SELECT TO authenticated USING (is_org_member(org_id));
CREATE POLICY polls_write ON public.polls FOR INSERT TO authenticated
  WITH CHECK (is_org_member(org_id) AND created_by = auth.uid());
CREATE POLICY polls_manage ON public.polls FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR is_org_admin(org_id))
  WITH CHECK (created_by = auth.uid() OR is_org_admin(org_id));
CREATE POLICY poll_options_read ON public.poll_options FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND is_org_member(p.org_id)));
CREATE POLICY poll_options_write ON public.poll_options FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.polls p
              WHERE p.id = poll_id AND (p.created_by = auth.uid() OR is_org_admin(p.org_id))));
CREATE POLICY poll_votes_rw ON public.poll_votes FOR ALL TO authenticated
  USING (user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND is_org_member(p.org_id)))
  WITH CHECK (user_id = auth.uid()
              AND EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND is_org_member(p.org_id)));

-- ----------------------------------------------------------------------------
-- Devices, notifications, moderation
-- ----------------------------------------------------------------------------
CREATE POLICY devices_own ON public.devices FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY notifications_read_own ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY notifications_mark_read ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY notifprefs_own ON public.notification_prefs FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY reports_create ON public.reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());
CREATE POLICY reports_read_own ON public.reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());
-- Review/resolution: service role dashboard.

CREATE POLICY blocks_own ON public.user_blocks FOR ALL TO authenticated
  USING (blocker_id = auth.uid()) WITH CHECK (blocker_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Payments & dues
-- Alumni carve-out: everyone may read/pay their OWN charges regardless of tier.
-- ----------------------------------------------------------------------------
CREATE POLICY payacct_read ON public.payment_accounts FOR SELECT TO authenticated
  USING (is_org_member(org_id));
CREATE POLICY payacct_manage ON public.payment_accounts FOR ALL TO authenticated
  USING (is_org_admin_or_treasurer(org_id)) WITH CHECK (is_org_admin_or_treasurer(org_id));

CREATE POLICY dues_cycles_read ON public.dues_cycles FOR SELECT TO authenticated
  USING (is_org_member(org_id));
CREATE POLICY dues_cycles_manage ON public.dues_cycles FOR ALL TO authenticated
  USING (is_org_admin_or_treasurer(org_id)) WITH CHECK (is_org_admin_or_treasurer(org_id));

CREATE POLICY charges_read ON public.charges FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_org_admin_or_treasurer(org_id));
CREATE POLICY charges_manage ON public.charges FOR ALL TO authenticated
  USING (is_org_admin_or_treasurer(org_id)) WITH CHECK (is_org_admin_or_treasurer(org_id));

CREATE POLICY payments_read ON public.payments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_org_admin_or_treasurer(org_id));
-- Payment creation happens in Edge Functions (service role) after Stripe confirms;
-- clients never insert payments directly.

CREATE POLICY paymethods_own ON public.payment_methods FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY plans_read ON public.payment_plans FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.charges c
                    WHERE c.id = charge_id AND is_org_admin_or_treasurer(c.org_id)));
CREATE POLICY plans_create_own ON public.payment_plans FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY installments_read ON public.installments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payment_plans pp
                 WHERE pp.id = plan_id
                   AND (pp.user_id = auth.uid()
                        OR EXISTS (SELECT 1 FROM public.charges c
                                   WHERE c.id = pp.charge_id AND is_org_admin_or_treasurer(c.org_id)))));

-- platform_fees / reconciliation_events: internal — service role only (no policies).
CREATE POLICY recon_read_treasurer ON public.reconciliation_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payments p
                 WHERE p.id = payment_id AND is_org_admin_or_treasurer(p.org_id)));

-- ----------------------------------------------------------------------------
-- Retention: purge location pings older than 90 days (requires pg_cron)
-- ----------------------------------------------------------------------------
-- SELECT cron.schedule('purge-old-locations', '15 3 * * *',
--   $$DELETE FROM public.locations WHERE captured_at < now() - interval '90 days'$$);
