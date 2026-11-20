-- ============================================================================
-- Rally cross-chapter security probe (UNFORGET A2)
--
-- WHAT IT DOES
--   Creates two throwaway users and chapters (A and B) at Kennesaw State, signs
--   in as user A (a member of chapter A only), then tries to read and change
--   chapter B's data. Every result is collected into one JSON report.
--
-- IT NEVER SAVES ANYTHING
--   The whole probe is ONE statement that ends with RAISE EXCEPTION, so
--   Postgres rolls back every row it created. The "error" you see IS the
--   report. Safe to run on the live project as often as you like.
--
-- HOW TO RUN
--   Supabase -> SQL Editor -> New query -> paste this whole file -> Run.
--   Or ask the rally-security agent to run it.
--
-- HOW TO READ THE REPORT
--   control_*   must be 1 (proves the probe is really signed in as A)
--   read_*      must be 0 (A must not see chapter B's rows)
--   write_*     must start with "blocked" or "ok:false"
--   info_*      by-design behaviour, listed so a human can judge it
--   Anything else is a LEAK -> fix it in a new migration.
-- ============================================================================
DO $probe$
DECLARE
  v_school uuid;
  v_a uuid := gen_random_uuid();       -- user A (attacker)
  v_b uuid := gen_random_uuid();       -- user B (victim)
  v_org_a uuid; v_org_b uuid;
  v_chat_a uuid; v_chat_b uuid;
  v_event_a uuid; v_event_b uuid;
  v_acct_b uuid; v_charge_b uuid;
  n bigint;
  j jsonb;
  r jsonb := '{}'::jsonb;
BEGIN
  SELECT id INTO v_school FROM public.schools WHERE name = 'Kennesaw State University';
  IF v_school IS NULL THEN
    RAISE EXCEPTION 'probe needs the Kennesaw State University row in public.schools';
  END IF;

  -- ---------------------------------------------------------------- setup ---
  INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  VALUES (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-a-' || v_a || '@probe.invalid', now(), now()),
         (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe-b-' || v_b || '@probe.invalid', now(), now());

  INSERT INTO public.profiles (id, username, full_name, birthday, account_type, school_id, phone)
  VALUES (v_a, 'probe_a_' || left(v_a::text, 8), 'Probe A', '2004-01-01', 'student', v_school, NULL),
         (v_b, 'probe_b_' || left(v_b::text, 8), 'Probe B', '2004-02-02', 'student', v_school, '555-0100');

  INSERT INTO public.organizations (name, type, school_id, created_by)
  VALUES ('Probe Chapter A', 'club', v_school, v_a) RETURNING id INTO v_org_a;
  INSERT INTO public.organizations (name, type, school_id, created_by)
  VALUES ('Probe Chapter B', 'club', v_school, v_b) RETURNING id INTO v_org_b;

  INSERT INTO public.memberships (org_id, user_id, role, status)
  VALUES (v_org_a, v_a, 'admin', 'active'), (v_org_b, v_b, 'admin', 'active');

  INSERT INTO public.chats (org_id, type, name, created_by)
  VALUES (v_org_a, 'group', 'Probe A chat', v_a) RETURNING id INTO v_chat_a;
  INSERT INTO public.chats (org_id, type, name, created_by)
  VALUES (v_org_b, 'group', 'Probe B chat', v_b) RETURNING id INTO v_chat_b;
  INSERT INTO public.chat_members (chat_id, user_id, role)
  VALUES (v_chat_a, v_a, 'admin'), (v_chat_b, v_b, 'admin')
  ON CONFLICT DO NOTHING;
  INSERT INTO public.messages (chat_id, sender_id, body)
  VALUES (v_chat_a, v_a, 'probe A message'), (v_chat_b, v_b, 'probe B secret');

  INSERT INTO public.events (org_id, created_by, title, starts_at)
  VALUES (v_org_a, v_a, 'Probe A event', now() + interval '1 day') RETURNING id INTO v_event_a;
  INSERT INTO public.events (org_id, created_by, title, starts_at, checkin_enabled,
                             checkin_radius_m, location)
  VALUES (v_org_b, v_b, 'Probe B event', now(), true, 5000,
          ST_SetSRID(ST_MakePoint(-84.58, 34.03), 4326)::geography)
  RETURNING id INTO v_event_b;
  INSERT INTO public.event_rsvps (event_id, user_id, status) VALUES (v_event_b, v_b, 'going');

  INSERT INTO public.location_settings (user_id, sharing_enabled, ghost_mode)
  VALUES (v_b, true, false)
  ON CONFLICT (user_id) DO UPDATE SET sharing_enabled = true, ghost_mode = false;
  INSERT INTO public.locations (user_id, point)
  VALUES (v_b, ST_SetSRID(ST_MakePoint(-84.58, 34.03), 4326)::geography);

  INSERT INTO public.payment_accounts (org_id, rail) VALUES (v_org_b, 'stripe_connect')
  RETURNING id INTO v_acct_b;
  INSERT INTO public.charges (org_id, user_id, payment_account_id, category, description,
                              amount_cents, due_date)
  VALUES (v_org_b, v_b, v_acct_b, 'local_dues', 'probe dues', 10000, current_date)
  RETURNING id INTO v_charge_b;

  -- ------------------------------------------------------ become user A ---
  PERFORM set_config('request.jwt.claims',
          json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_a::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- controls: A must see its OWN chapter (proves the sign-in worked)
  SELECT count(*) INTO n FROM public.events WHERE id = v_event_a;
  r := r || jsonb_build_object('control_own_event', n);
  SELECT count(*) INTO n FROM public.messages WHERE chat_id = v_chat_a;
  r := r || jsonb_build_object('control_own_messages', n);

  -- reads: all must be 0
  SELECT count(*) INTO n FROM public.events WHERE org_id = v_org_b;
  r := r || jsonb_build_object('read_events_B', n);
  SELECT count(*) INTO n FROM public.chats WHERE id = v_chat_b;
  r := r || jsonb_build_object('read_chats_B', n);
  SELECT count(*) INTO n FROM public.messages WHERE chat_id = v_chat_b;
  r := r || jsonb_build_object('read_messages_B', n);
  SELECT count(*) INTO n FROM public.chat_members WHERE chat_id = v_chat_b;
  r := r || jsonb_build_object('read_chat_members_B', n);
  SELECT count(*) INTO n FROM public.memberships WHERE org_id = v_org_b;
  r := r || jsonb_build_object('read_memberships_B', n);
  SELECT count(*) INTO n FROM public.charges WHERE org_id = v_org_b;
  r := r || jsonb_build_object('read_charges_B', n);
  SELECT count(*) INTO n FROM public.payment_accounts WHERE org_id = v_org_b;
  r := r || jsonb_build_object('read_payment_accounts_B', n);
  SELECT count(*) INTO n FROM public.locations WHERE user_id = v_b;
  r := r || jsonb_build_object('read_locations_B', n);
  SELECT count(*) INTO n FROM public.get_visible_locations() g WHERE g.user_id = v_b;
  r := r || jsonb_build_object('read_get_visible_locations_B', n);
  SELECT count(*) INTO n FROM public.location_settings WHERE user_id = v_b;
  r := r || jsonb_build_object('read_location_settings_B', n);
  SELECT count(*) INTO n FROM public.event_rsvps WHERE event_id = v_event_b;
  r := r || jsonb_build_object('read_rsvps_B', n);
  BEGIN
    SELECT count(*) INTO n FROM public.org_dues_summary(v_org_b);
    r := r || jsonb_build_object('read_org_dues_summary_B', n);
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('read_org_dues_summary_B', 0);
  END;

  -- info: same-campus visibility (by design for search/join, but check fields)
  SELECT count(*) INTO n FROM public.organizations WHERE id = v_org_b;
  r := r || jsonb_build_object('info_campus_org_B_visible', n);
  SELECT count(*) INTO n FROM public.profiles WHERE id = v_b;
  r := r || jsonb_build_object('info_campus_profile_B_visible', n);
  -- After 0012 these columns aren't readable at all, so the query errors.
  BEGIN
    SELECT count(*) INTO n FROM public.profiles
     WHERE id = v_b AND (birthday IS NOT NULL OR phone IS NOT NULL);
    r := r || jsonb_build_object('info_profile_B_private_fields',
           CASE WHEN n = 0 THEN 'hidden' ELSE 'LEAK birthday/phone readable' END);
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('info_profile_B_private_fields', 'blocked: ' || SQLERRM);
  END;

  -- writes: all must be blocked
  BEGIN
    INSERT INTO public.events (org_id, created_by, title, starts_at)
    VALUES (v_org_b, v_a, 'evil', now());
    r := r || jsonb_build_object('write_insert_event_B', 'LEAK inserted');
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('write_insert_event_B', 'blocked: ' || SQLERRM);
  END;

  BEGIN
    UPDATE public.events SET title = 'pwned' WHERE id = v_event_b;
    GET DIAGNOSTICS n = ROW_COUNT;
    r := r || jsonb_build_object('write_update_event_B',
           CASE WHEN n = 0 THEN 'blocked (0 rows)' ELSE 'LEAK rows=' || n END);
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('write_update_event_B', 'blocked: ' || SQLERRM);
  END;

  BEGIN
    DELETE FROM public.events WHERE id = v_event_b;
    GET DIAGNOSTICS n = ROW_COUNT;
    r := r || jsonb_build_object('write_delete_event_B',
           CASE WHEN n = 0 THEN 'blocked (0 rows)' ELSE 'LEAK rows=' || n END);
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('write_delete_event_B', 'blocked: ' || SQLERRM);
  END;

  BEGIN
    INSERT INTO public.messages (chat_id, sender_id, body) VALUES (v_chat_b, v_a, 'evil');
    r := r || jsonb_build_object('write_insert_message_B', 'LEAK inserted');
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('write_insert_message_B', 'blocked: ' || SQLERRM);
  END;

  BEGIN
    INSERT INTO public.chat_members (chat_id, user_id) VALUES (v_chat_b, v_a);
    SELECT count(*) INTO n FROM public.messages WHERE chat_id = v_chat_b;
    r := r || jsonb_build_object('write_join_chat_B',
           'LEAK joined; can now read ' || n || ' message(s)');
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('write_join_chat_B', 'blocked: ' || SQLERRM);
  END;

  BEGIN
    INSERT INTO public.memberships (org_id, user_id, role, status)
    VALUES (v_org_b, v_a, 'admin', 'active');
    r := r || jsonb_build_object('write_self_admin_B', 'LEAK inserted');
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('write_self_admin_B', 'blocked: ' || SQLERRM);
  END;

  BEGIN
    DELETE FROM public.memberships WHERE org_id = v_org_b;
    GET DIAGNOSTICS n = ROW_COUNT;
    r := r || jsonb_build_object('write_delete_memberships_B',
           CASE WHEN n = 0 THEN 'blocked (0 rows)' ELSE 'LEAK rows=' || n END);
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('write_delete_memberships_B', 'blocked: ' || SQLERRM);
  END;

  BEGIN
    INSERT INTO public.charges (org_id, user_id, payment_account_id, category, amount_cents)
    VALUES (v_org_b, v_a, v_acct_b, 'fine', 1);
    r := r || jsonb_build_object('write_insert_charge_B', 'LEAK inserted');
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('write_insert_charge_B', 'blocked: ' || SQLERRM);
  END;

  BEGIN
    UPDATE public.location_settings SET ghost_mode = true WHERE user_id = v_b;
    GET DIAGNOSTICS n = ROW_COUNT;
    r := r || jsonb_build_object('write_location_settings_B',
           CASE WHEN n = 0 THEN 'blocked (0 rows)' ELSE 'LEAK rows=' || n END);
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('write_location_settings_B', 'blocked: ' || SQLERRM);
  END;

  BEGIN
    INSERT INTO public.event_rsvps (event_id, user_id, status) VALUES (v_event_b, v_a, 'going');
    r := r || jsonb_build_object('write_rsvp_event_B', 'LEAK inserted');
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('write_rsvp_event_B', 'blocked: ' || SQLERRM);
  END;

  -- RPCs (SECURITY DEFINER, so they must check permissions themselves)
  BEGIN
    SELECT to_jsonb(x) INTO j FROM public.create_chat_invite(v_chat_b) x;
    r := r || jsonb_build_object('write_rpc_create_chat_invite_B', coalesce(j, 'null'::jsonb));
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('write_rpc_create_chat_invite_B', 'blocked: ' || SQLERRM);
  END;

  BEGIN
    SELECT to_jsonb(x) INTO j
      FROM public.add_chat_member_by_username(v_chat_b, ('probe_a_' || left(v_a::text, 8))::citext) x;
    r := r || jsonb_build_object('write_rpc_add_member_chat_B', coalesce(j, 'null'::jsonb));
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('write_rpc_add_member_chat_B', 'blocked: ' || SQLERRM);
  END;

  BEGIN
    SELECT to_jsonb(x) INTO j FROM public.checkin_to_event(v_event_b, 34.03, -84.58) x;
    r := r || jsonb_build_object('write_rpc_checkin_event_B', coalesce(j, 'null'::jsonb));
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('write_rpc_checkin_event_B', 'blocked: ' || SQLERRM);
  END;

  BEGIN
    SELECT to_jsonb(x) INTO j FROM public.record_manual_payment(v_charge_b, 10000, 'evil') x;
    r := r || jsonb_build_object('write_rpc_record_manual_payment_B', coalesce(j, 'null'::jsonb));
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('write_rpc_record_manual_payment_B', 'blocked: ' || SQLERRM);
  END;

  BEGIN
    SELECT to_jsonb(x) INTO j FROM public.set_charge_status(v_charge_b, 'waived') x;
    r := r || jsonb_build_object('write_rpc_set_charge_status_B', coalesce(j, 'null'::jsonb));
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('write_rpc_set_charge_status_B', 'blocked: ' || SQLERRM);
  END;

  BEGIN
    SELECT to_jsonb(x) INTO j
      FROM public.create_charge(v_org_b, v_b, 'evil', 1, current_date, 'fine') x;
    r := r || jsonb_build_object('write_rpc_create_charge_B', coalesce(j, 'null'::jsonb));
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('write_rpc_create_charge_B', 'blocked: ' || SQLERRM);
  END;

  BEGIN
    SELECT to_jsonb(x) INTO j
      FROM public.record_stripe_payment(v_charge_b, 'evil_' || v_a, 10000, 0, 0, 'card') x;
    r := r || jsonb_build_object('write_rpc_record_stripe_payment_B', coalesce(j, 'null'::jsonb));
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('write_rpc_record_stripe_payment_B', 'blocked: ' || SQLERRM);
  END;

  BEGIN
    SELECT to_jsonb(x) INTO j
      FROM public.set_stripe_account(v_org_b, 'acct_evil', 'active') x;
    r := r || jsonb_build_object('write_rpc_set_stripe_account_B', coalesce(j, 'null'::jsonb));
  EXCEPTION WHEN others THEN
    r := r || jsonb_build_object('write_rpc_set_stripe_account_B', 'blocked: ' || SQLERRM);
  END;

  -- Report, and throw everything away.
  RAISE EXCEPTION 'RLS_PROBE_REPORT %', jsonb_pretty(r);
END $probe$;
