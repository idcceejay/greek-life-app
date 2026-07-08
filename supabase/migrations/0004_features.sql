-- ============================================================================
-- Greek Life App — 0004_features.sql
-- Location-gated event check-in, chat invite links, sticker packs,
-- and profile-creation/verification RPC. Run after 0003.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Event check-in (host enables; user must physically be within the radius)
-- ----------------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN checkin_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN checkin_radius_m integer NOT NULL DEFAULT 150;

CREATE TABLE public.event_checkins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  distance_m    real,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
CREATE INDEX idx_event_checkins_event ON public.event_checkins (event_id);
ALTER TABLE public.event_checkins ENABLE ROW LEVEL SECURITY;

-- Org members can see who checked in; inserts happen ONLY via the RPC below.
CREATE POLICY checkins_read ON public.event_checkins FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e
                 WHERE e.id = event_id AND is_org_member(e.org_id)));

-- Server-side proximity validation: the client sends its coordinates, Postgres
-- (PostGIS) measures the real distance to the event pin. No client-side trust.
CREATE OR REPLACE FUNCTION public.checkin_to_event(p_event uuid, p_lat double precision, p_lng double precision)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event record;
  v_dist double precision;
BEGIN
  SELECT e.id, e.org_id, e.location, e.checkin_enabled, e.checkin_radius_m,
         e.starts_at, e.ends_at
    INTO v_event FROM events e WHERE e.id = p_event;
  IF v_event.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'event_not_found'); END IF;
  IF NOT is_org_member(v_event.org_id) THEN RETURN jsonb_build_object('ok', false, 'error', 'not_a_member'); END IF;
  IF NOT v_event.checkin_enabled THEN RETURN jsonb_build_object('ok', false, 'error', 'checkin_disabled'); END IF;
  IF v_event.location IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'event_has_no_location'); END IF;
  IF now() < v_event.starts_at - interval '1 hour'
     OR (v_event.ends_at IS NOT NULL AND now() > v_event.ends_at + interval '1 hour') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'outside_checkin_window');
  END IF;

  v_dist := ST_Distance(
    v_event.location,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  );
  IF v_dist > v_event.checkin_radius_m THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_far', 'distance_m', round(v_dist::numeric, 1));
  END IF;

  INSERT INTO event_checkins (event_id, user_id, distance_m)
  VALUES (p_event, auth.uid(), v_dist)
  ON CONFLICT (event_id, user_id) DO UPDATE SET checked_in_at = now(), distance_m = EXCLUDED.distance_m;

  RETURN jsonb_build_object('ok', true, 'distance_m', round(v_dist::numeric, 1));
END $$;

-- ----------------------------------------------------------------------------
-- Chat invite links (Snapchat/GroupMe-style "join via link")
-- ----------------------------------------------------------------------------
CREATE TABLE public.chat_invites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  token      text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  max_uses   integer,                -- null = unlimited
  uses       integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_invites_chat ON public.chat_invites (chat_id);
ALTER TABLE public.chat_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_invites_admin ON public.chat_invites FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_members cm
                 WHERE cm.chat_id = chat_invites.chat_id
                   AND cm.user_id = auth.uid() AND cm.role = 'admin'))
  WITH CHECK (created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.join_chat_via_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv record;
BEGIN
  SELECT * INTO v_inv FROM chat_invites
   WHERE token = p_token AND revoked_at IS NULL
     AND (expires_at IS NULL OR expires_at > now())
     AND (max_uses IS NULL OR uses < max_uses);
  IF v_inv.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_expired'); END IF;

  INSERT INTO chat_members (chat_id, user_id)
  VALUES (v_inv.chat_id, auth.uid())
  ON CONFLICT (chat_id, user_id) DO NOTHING;

  UPDATE chat_invites SET uses = uses + 1 WHERE id = v_inv.id;
  RETURN jsonb_build_object('ok', true, 'chat_id', v_inv.chat_id);
END $$;

-- ----------------------------------------------------------------------------
-- Sticker packs (chapter-owned custom stickers; images in a storage bucket)
-- ----------------------------------------------------------------------------
CREATE TABLE public.sticker_packs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.stickers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id    uuid NOT NULL REFERENCES public.sticker_packs(id) ON DELETE CASCADE,
  image_url  text NOT NULL,          -- 'stickers' storage bucket
  emoji_tag  text,                   -- optional search tag
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ADD COLUMN sticker_id uuid REFERENCES public.stickers(id) ON DELETE SET NULL;
CREATE INDEX idx_stickers_pack ON public.stickers (pack_id);
ALTER TABLE public.sticker_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stickers ENABLE ROW LEVEL SECURITY;

CREATE POLICY sticker_packs_read ON public.sticker_packs FOR SELECT TO authenticated
  USING (is_org_member(org_id));
CREATE POLICY sticker_packs_manage ON public.sticker_packs FOR ALL TO authenticated
  USING (is_org_admin(org_id)) WITH CHECK (is_org_admin(org_id));
CREATE POLICY stickers_read ON public.stickers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sticker_packs sp
                 WHERE sp.id = pack_id AND is_org_member(sp.org_id)));
CREATE POLICY stickers_manage ON public.stickers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sticker_packs sp
                 WHERE sp.id = pack_id AND is_org_admin(sp.org_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sticker_packs sp
                 WHERE sp.id = pack_id AND is_org_admin(sp.org_id)));

-- ----------------------------------------------------------------------------
-- Live map read model: latest visible pin per person, as plain lat/lng.
-- Respects the same visibility rules as RLS on locations (shared active org,
-- sharing on, no ghost mode) and never exposes anything else.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_visible_locations()
RETURNS TABLE (
  user_id uuid, username citext, full_name text, avatar_url text,
  lat double precision, lng double precision,
  place_label text, captured_at timestamptz, is_self boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ll.user_id,
         p.username,
         p.full_name,
         p.avatar_url,
         ST_Y(ll.point::geometry) AS lat,
         ST_X(ll.point::geometry) AS lng,
         ll.place_label,
         ll.captured_at,
         ll.user_id = auth.uid() AS is_self
  FROM latest_locations ll
  JOIN profiles p ON p.id = ll.user_id
  WHERE ll.captured_at > now() - interval '2 hours'
    AND (
      ll.user_id = auth.uid()
      OR (
        is_student()
        AND shares_active_org_with(ll.user_id)
        AND EXISTS (SELECT 1 FROM location_settings ls
                    WHERE ls.user_id = ll.user_id
                      AND ls.sharing_enabled AND NOT ls.ghost_mode)
      )
    );
$$;

-- ----------------------------------------------------------------------------
-- Profile creation + automatic student detection (called after first sign-in)
-- Matches the signer's email domain against school_domains: match → student
-- affiliation at that school; no match → alumni-tier account.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_profile(p_username text, p_full_name text, p_birthday date)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email citext;
  v_domain citext;
  v_school uuid;
BEGIN
  SELECT email::citext INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_user'); END IF;
  v_domain := split_part(v_email::text, '@', 2);
  SELECT school_id INTO v_school FROM school_domains WHERE domain = v_domain;

  INSERT INTO profiles (id, username, full_name, birthday, account_type, edu_verified, school_email, school_id)
  VALUES (
    auth.uid(), p_username, p_full_name, p_birthday,
    CASE WHEN v_school IS NULL THEN 'alumni'::account_type ELSE 'student'::account_type END,
    v_school IS NOT NULL,
    CASE WHEN v_school IS NULL THEN NULL ELSE v_email END,
    v_school
  )
  ON CONFLICT (id) DO UPDATE
    SET username = EXCLUDED.username, full_name = EXCLUDED.full_name, birthday = EXCLUDED.birthday;

  IF v_school IS NOT NULL THEN
    INSERT INTO school_affiliations (user_id, school_id, school_email, status, verified_at, verification_method)
    VALUES (auth.uid(), v_school, v_email, 'current', now(), 'email_otp')
    ON CONFLICT (user_id, school_id) DO NOTHING;
  END IF;

  INSERT INTO location_settings (user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  INSERT INTO notification_prefs (user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'student', v_school IS NOT NULL);
END $$;
