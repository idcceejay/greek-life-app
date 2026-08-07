-- ============================================================================
-- Greek Life App — 0006_chat_groups_invites.sql
-- Atomic group-chat creation (fixes RLS insert failure), invite codes,
-- and adding members by username. Run after 0005.
-- ============================================================================

-- Creating a chat + the creator's admin membership can't be done safely in two
-- client calls under RLS (the chat row isn't readable until you're a member).
CREATE OR REPLACE FUNCTION public.create_group_chat(p_name text, p_org uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_chat uuid; v_org uuid;
BEGIN
  IF NOT is_active() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_allowed');
  END IF;
  IF length(trim(p_name)) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'name_too_short');
  END IF;

  -- Attach to the caller's org when they have one (any membership status).
  v_org := p_org;
  IF v_org IS NULL THEN
    SELECT org_id INTO v_org FROM memberships
     WHERE user_id = auth.uid() ORDER BY joined_at LIMIT 1;
  END IF;

  INSERT INTO chats (org_id, type, name, created_by)
  VALUES (v_org, 'group', trim(p_name), auth.uid())
  RETURNING id INTO v_chat;

  INSERT INTO chat_members (chat_id, user_id, role)
  VALUES (v_chat, auth.uid(), 'admin');

  RETURN jsonb_build_object('ok', true, 'chat_id', v_chat);
END $$;

-- Mint (or reuse) a shareable invite code for a chat. Chat admins only.
CREATE OR REPLACE FUNCTION public.create_chat_invite(p_chat uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_token text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM chat_members
     WHERE chat_id = p_chat AND user_id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admins_only');
  END IF;

  SELECT token INTO v_token FROM chat_invites
   WHERE chat_id = p_chat AND revoked_at IS NULL
     AND (expires_at IS NULL OR expires_at > now())
   ORDER BY created_at DESC LIMIT 1;

  IF v_token IS NULL THEN
    INSERT INTO chat_invites (chat_id, created_by, expires_at)
    VALUES (p_chat, auth.uid(), now() + interval '30 days')
    RETURNING token INTO v_token;
  END IF;

  RETURN jsonb_build_object('ok', true, 'token', v_token);
END $$;

-- Add someone to a chat by username. Chat admins only; the target must share a
-- campus or an organization with the caller (no cross-school adds).
CREATE OR REPLACE FUNCTION public.add_chat_member_by_username(p_chat uuid, p_username citext)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid; v_school uuid; v_target_school uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM chat_members
     WHERE chat_id = p_chat AND user_id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admins_only');
  END IF;

  SELECT id, school_id INTO v_user, v_target_school
    FROM profiles WHERE username = p_username;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_such_user');
  END IF;

  SELECT school_id INTO v_school FROM profiles WHERE id = auth.uid();
  IF v_target_school IS DISTINCT FROM v_school AND NOT shares_active_org_with(v_user) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_same_campus');
  END IF;

  INSERT INTO chat_members (chat_id, user_id)
  VALUES (p_chat, v_user)
  ON CONFLICT (chat_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END $$;

-- Search students on my campus by username / name (for the "add member" picker).
CREATE OR REPLACE FUNCTION public.search_users(p_query text)
RETURNS TABLE (id uuid, username citext, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.full_name
  FROM profiles p
  WHERE p.id <> auth.uid()
    AND NOT p.is_suspended
    AND length(trim(p_query)) >= 2
    AND (p.username ILIKE '%' || trim(p_query) || '%'
         OR p.full_name ILIKE '%' || trim(p_query) || '%')
    AND (p.school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
         OR shares_active_org_with(p.id))
  ORDER BY p.username
  LIMIT 15;
$$;
