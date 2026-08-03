-- ============================================================================
-- Greek Life App — 0007_account_deletion_moderation.sql
-- App Store compliance: permanent in-app account deletion (Guideline 5.1.1(v))
-- and the moderation plumbing behind report/block (Guideline 1.2).
-- Run after 0006.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Permanent account deletion. Apple requires deletion, not deactivation.
-- Deleting the auth user cascades to profiles → memberships, messages(sender
-- SET NULL), locations, votes, etc. per the FK rules in 0001.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;

  -- Hand sole-admin orgs to another active member so chapters aren't orphaned.
  UPDATE memberships m
     SET role = 'admin'
   WHERE m.id IN (
     SELECT DISTINCT ON (a.org_id) b.id
       FROM memberships a
       JOIN memberships b ON b.org_id = a.org_id
                         AND b.user_id <> v_user
                         AND b.status = 'active'
      WHERE a.user_id = v_user
        AND a.role = 'admin'
        AND NOT EXISTS (
          SELECT 1 FROM memberships c
           WHERE c.org_id = a.org_id AND c.user_id <> v_user
             AND c.role = 'admin' AND c.status = 'active')
      ORDER BY a.org_id, b.joined_at
   );

  -- Scrub authored content that would otherwise linger with a null author.
  UPDATE posts    SET deleted_at = now() WHERE author_id = v_user;
  UPDATE comments SET deleted_at = now() WHERE author_id = v_user;
  UPDATE messages SET deleted_at = now(), body = NULL, attachment_url = NULL
   WHERE sender_id = v_user;

  DELETE FROM auth.users WHERE id = v_user;  -- cascades to profiles and children

  RETURN jsonb_build_object('ok', true);
END $$;

-- ----------------------------------------------------------------------------
-- Moderation: reporting hides content immediately for the reporter, and an
-- auto-hide threshold takes anything with 3+ open reports out of every feed
-- until a human reviews it (Apple wants objectionable content gone fast).
-- ----------------------------------------------------------------------------
ALTER TABLE public.posts    ADD COLUMN IF NOT EXISTS hidden_at timestamptz;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS hidden_at timestamptz;

CREATE OR REPLACE FUNCTION public.report_content(
  p_target_type public.report_target,
  p_target_id uuid,
  p_reason public.report_reason,
  p_detail text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_open int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;

  INSERT INTO reports (reporter_id, target_type, target_id, reason, detail)
  VALUES (auth.uid(), p_target_type, p_target_id, p_reason, p_detail);

  SELECT count(*) INTO v_open
    FROM reports
   WHERE target_id = p_target_id AND status = 'open';

  IF v_open >= 3 THEN
    IF p_target_type = 'post' THEN
      UPDATE posts SET hidden_at = now() WHERE id = p_target_id AND hidden_at IS NULL;
    ELSIF p_target_type = 'comment' THEN
      UPDATE comments SET hidden_at = now() WHERE id = p_target_id AND hidden_at IS NULL;
    ELSIF p_target_type = 'message' THEN
      UPDATE messages SET deleted_at = now() WHERE id = p_target_id AND deleted_at IS NULL;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'auto_hidden', v_open >= 3);
END $$;

-- Feed reads must skip auto-hidden posts and anything I reported.
DROP POLICY IF EXISTS posts_read_students ON public.posts;
CREATE POLICY posts_read_students ON public.posts FOR SELECT TO authenticated
  USING (
    is_student() AND deleted_at IS NULL AND hidden_at IS NULL
    AND ((scope = 'campus' AND school_id = current_school_id())
      OR (scope = 'chapter' AND is_org_member(org_id)))
    AND NOT EXISTS (SELECT 1 FROM public.user_blocks b
                    WHERE b.blocker_id = auth.uid() AND b.blocked_id = posts.author_id)
    AND NOT EXISTS (SELECT 1 FROM public.reports r
                    WHERE r.reporter_id = auth.uid()
                      AND r.target_type = 'post' AND r.target_id = posts.id)
  );

DROP POLICY IF EXISTS comments_read ON public.comments;
CREATE POLICY comments_read ON public.comments FOR SELECT TO authenticated
  USING (
    is_student() AND deleted_at IS NULL AND hidden_at IS NULL
    AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id)
    AND NOT EXISTS (SELECT 1 FROM public.user_blocks b
                    WHERE b.blocker_id = auth.uid() AND b.blocked_id = comments.author_id)
  );

-- Blocking must cut both directions in chat (they can't see me either).
DROP POLICY IF EXISTS messages_read ON public.messages;
CREATE POLICY messages_read ON public.messages FOR SELECT TO authenticated
  USING (
    is_chat_member(chat_id)
    AND deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
       WHERE (b.blocker_id = auth.uid() AND b.blocked_id = messages.sender_id)
          OR (b.blocked_id = auth.uid() AND b.blocker_id = messages.sender_id)
    )
  );

-- Who have I blocked (for the settings list)?
CREATE OR REPLACE FUNCTION public.my_blocked_users()
RETURNS TABLE (user_id uuid, username citext, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.full_name
  FROM user_blocks b
  JOIN profiles p ON p.id = b.blocked_id
  WHERE b.blocker_id = auth.uid()
  ORDER BY p.username;
$$;

-- Block by user id (used from a post/message context where I only know the author).
CREATE OR REPLACE FUNCTION public.block_user(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user IS NULL OR p_user = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_target');
  END IF;
  INSERT INTO user_blocks (blocker_id, blocked_id)
  VALUES (auth.uid(), p_user)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
  RETURN jsonb_build_object('ok', true);
END $$;

-- Reporting a post also needs the author id, which the feed doesn't expose.
-- This returns the author only to the reporter, only for blocking purposes.
CREATE OR REPLACE FUNCTION public.block_post_author(p_post uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_author uuid;
BEGIN
  SELECT author_id INTO v_author FROM posts WHERE id = p_post;
  IF v_author IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_author');
  END IF;
  RETURN block_user(v_author);
END $$;
