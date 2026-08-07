-- ============================================================================
-- Greek Life App — 0005_app_rpcs.sql
-- Org creation RPC (creator becomes admin atomically) + Realtime publication.
-- Run after 0004.
-- ============================================================================

-- Creating an org requires inserting the org AND the creator's admin membership,
-- which plain RLS can't allow safely in two client calls. One atomic RPC instead.
CREATE OR REPLACE FUNCTION public.create_organization(p_name text, p_type public.org_type)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_school uuid;
  v_org uuid;
  v_chat uuid;
BEGIN
  IF NOT is_student() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'students_only');
  END IF;
  IF length(trim(p_name)) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'name_too_short');
  END IF;
  SELECT school_id INTO v_school FROM profiles WHERE id = auth.uid();

  INSERT INTO organizations (name, type, school_id, created_by)
  VALUES (trim(p_name), p_type, v_school, auth.uid())
  RETURNING id INTO v_org;

  INSERT INTO memberships (org_id, user_id, role, status)
  VALUES (v_org, auth.uid(), 'admin', 'active');

  -- Default all-members announcement-style chat
  INSERT INTO chats (org_id, type, name, created_by)
  VALUES (v_org, 'group', 'All Members', auth.uid())
  RETURNING id INTO v_chat;
  INSERT INTO chat_members (chat_id, user_id, role) VALUES (v_chat, auth.uid(), 'admin');

  RETURN jsonb_build_object('ok', true, 'org_id', v_org);
END $$;

-- New active members auto-join the org's group chats
CREATE OR REPLACE FUNCTION public.tg_membership_join_chats() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'active' THEN
    INSERT INTO chat_members (chat_id, user_id)
    SELECT c.id, NEW.user_id FROM chats c
    WHERE c.org_id = NEW.org_id AND c.type IN ('group', 'announcement')
    ON CONFLICT (chat_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_membership_join_chats ON public.memberships;
CREATE TRIGGER trg_membership_join_chats
  AFTER INSERT OR UPDATE OF status ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.tg_membership_join_chats();

-- Enable Realtime change events for chat (RLS still applies to subscribers)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
