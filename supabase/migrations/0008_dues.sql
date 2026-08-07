-- ============================================================================
-- Rally — 0008_dues.sql
-- Dues & payments logic on top of the v6/v7 ledger tables (charges, payments,
-- dues_cycles, payment_accounts, platform_fees). Run after 0007.
--
-- Design recap: `charges` is the source of truth for who owes what. `payments`
-- record money movement against a charge. Charge status is trigger-maintained
-- (see tg_settle_charge in 0001) — never set 'paid' by hand from the client.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Every org needs a payment account row before charges can reference one.
-- For chapters not yet on Stripe we create a placeholder 'stripe_connect'
-- account in 'pending' status so the ledger works offline (manual payments),
-- then Stripe onboarding fills in external_ref and flips it to 'active'.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_payment_account(p_org uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM payment_accounts
   WHERE org_id = p_org AND rail = 'stripe_connect';
  IF v_id IS NULL THEN
    INSERT INTO payment_accounts (org_id, rail, status, reconcile_mode)
    VALUES (p_org, 'stripe_connect', 'pending', 'webhook')
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $$;

-- ----------------------------------------------------------------------------
-- Create a dues cycle and generate one charge per active member.
-- Treasurer/admin only. Idempotent per (cycle, member).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_dues_cycle(
  p_org uuid,
  p_name text,
  p_amount_cents integer,
  p_due_date date,
  p_category public.charge_category DEFAULT 'local_dues',
  p_scope public.dues_scope DEFAULT 'all'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cycle uuid;
  v_account uuid;
  v_count int;
BEGIN
  IF NOT is_org_admin_or_treasurer(p_org) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;
  IF p_amount_cents IS NULL OR p_amount_cents < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_amount');
  END IF;
  IF length(trim(coalesce(p_name, ''))) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'name_required');
  END IF;

  v_account := ensure_payment_account(p_org);

  INSERT INTO dues_cycles (org_id, created_by, name, scope, default_amount_cents, due_date)
  VALUES (p_org, auth.uid(), trim(p_name), p_scope, p_amount_cents, p_due_date)
  RETURNING id INTO v_cycle;

  INSERT INTO charges (org_id, user_id, dues_cycle_id, payment_account_id,
                       category, description, amount_cents, due_date)
  SELECT p_org, m.user_id, v_cycle, v_account,
         p_category, trim(p_name), p_amount_cents, p_due_date
  FROM memberships m
  WHERE m.org_id = p_org
    AND m.status = 'active'
    AND (p_scope <> 'new_members' OR m.joined_at > now() - interval '120 days');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'cycle_id', v_cycle, 'charges_created', v_count);
END $$;

-- ----------------------------------------------------------------------------
-- One-off charge for a single member (fine, merch, event fee).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_charge(
  p_org uuid,
  p_user uuid,
  p_description text,
  p_amount_cents integer,
  p_due_date date DEFAULT NULL,
  p_category public.charge_category DEFAULT 'fine'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_account uuid; v_id uuid;
BEGIN
  IF NOT is_org_admin_or_treasurer(p_org) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;
  v_account := ensure_payment_account(p_org);
  INSERT INTO charges (org_id, user_id, payment_account_id, category,
                       description, amount_cents, due_date)
  VALUES (p_org, p_user, v_account, p_category, p_description, p_amount_cents, p_due_date)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'charge_id', v_id);
END $$;

-- ----------------------------------------------------------------------------
-- What do I owe? (any member, own charges only)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_charges()
RETURNS TABLE (
  id uuid, org_id uuid, org_name text, description text,
  category public.charge_category, amount_cents integer, paid_cents bigint,
  due_date date, status public.charge_status, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.org_id, o.name, c.description, c.category, c.amount_cents,
         COALESCE((SELECT SUM(p.gross_cents) FROM payments p
                    WHERE p.charge_id = c.id AND p.status = 'succeeded'), 0) AS paid_cents,
         c.due_date, c.status, c.created_at
  FROM charges c
  JOIN organizations o ON o.id = c.org_id
  WHERE c.user_id = auth.uid()
    AND c.status <> 'void'
  ORDER BY (c.status IN ('unpaid','partial')) DESC, c.due_date NULLS LAST, c.created_at DESC;
$$;

-- ----------------------------------------------------------------------------
-- Treasurer view: every member's balance in the org.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.org_dues_summary(p_org uuid)
RETURNS TABLE (
  user_id uuid, full_name text, username citext,
  owed_cents bigint, paid_cents bigint, overdue boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.user_id,
         p.full_name,
         p.username,
         COALESCE(SUM(c.amount_cents) FILTER (WHERE c.status IN ('unpaid','partial')), 0)
           - COALESCE(SUM(pay.paid) FILTER (WHERE c.status IN ('unpaid','partial')), 0) AS owed_cents,
         COALESCE(SUM(pay.paid), 0) AS paid_cents,
         COALESCE(bool_or(c.due_date < current_date AND c.status IN ('unpaid','partial')), false) AS overdue
  FROM memberships m
  JOIN profiles p ON p.id = m.user_id
  LEFT JOIN charges c ON c.user_id = m.user_id AND c.org_id = m.org_id AND c.status <> 'void'
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(x.gross_cents), 0) AS paid
    FROM payments x WHERE x.charge_id = c.id AND x.status = 'succeeded'
  ) pay ON true
  WHERE m.org_id = p_org
    AND m.status = 'active'
    AND is_org_admin_or_treasurer(p_org)
  GROUP BY m.user_id, p.full_name, p.username
  ORDER BY owed_cents DESC, p.full_name;
$$;

-- ----------------------------------------------------------------------------
-- Record a payment collected outside Stripe (cash, Venmo, check).
-- Treasurer/admin only; leaves an audit trail in reconciliation_events.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_manual_payment(
  p_charge uuid,
  p_amount_cents integer,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_account uuid; v_user uuid; v_payment uuid;
BEGIN
  SELECT org_id, payment_account_id, user_id INTO v_org, v_account, v_user
    FROM charges WHERE id = p_charge;
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_such_charge');
  END IF;
  IF NOT is_org_admin_or_treasurer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;
  IF p_amount_cents <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_amount');
  END IF;

  INSERT INTO payments (charge_id, user_id, payment_account_id, channel,
                        gross_cents, processor_fee_cents, application_fee_cents,
                        net_cents, status, reconciliation_source, paid_at)
  VALUES (p_charge, v_user, v_account, 'card',
          p_amount_cents, 0, 0, p_amount_cents, 'succeeded', 'manual', now())
  RETURNING id INTO v_payment;

  INSERT INTO reconciliation_events (payment_id, source, actor_id, external_ref)
  VALUES (v_payment, 'manual', auth.uid(), p_note);

  RETURN jsonb_build_object('ok', true, 'payment_id', v_payment);
END $$;

-- ----------------------------------------------------------------------------
-- Waive / void a charge (treasurer decision, not a payment).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_charge_status(p_charge uuid, p_status public.charge_status)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid;
BEGIN
  IF p_status NOT IN ('waived', 'void', 'unpaid') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'status_not_settable');
  END IF;
  SELECT org_id INTO v_org FROM charges WHERE id = p_charge;
  IF NOT is_org_admin_or_treasurer(v_org) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;
  UPDATE charges SET status = p_status WHERE id = p_charge;
  RETURN jsonb_build_object('ok', true);
END $$;

-- ----------------------------------------------------------------------------
-- Stripe bookkeeping, called only by the webhook Edge Function (service role).
-- Idempotent on the Stripe object id so replayed webhooks don't double-count.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_stripe_payment(
  p_charge uuid,
  p_external_ref text,
  p_gross_cents integer,
  p_processor_fee_cents integer,
  p_application_fee_cents integer,
  p_channel public.payment_channel DEFAULT 'card'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_account uuid; v_user uuid; v_payment uuid; v_net integer;
BEGIN
  IF EXISTS (SELECT 1 FROM payments WHERE external_ref = p_external_ref) THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  SELECT org_id, payment_account_id, user_id INTO v_org, v_account, v_user
    FROM charges WHERE id = p_charge;
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_such_charge');
  END IF;

  v_net := p_gross_cents - p_processor_fee_cents - p_application_fee_cents;

  INSERT INTO payments (charge_id, user_id, payment_account_id, channel,
                        gross_cents, processor_fee_cents, application_fee_cents,
                        net_cents, external_ref, status, reconciliation_source, paid_at)
  VALUES (p_charge, v_user, v_account, p_channel,
          p_gross_cents, p_processor_fee_cents, p_application_fee_cents,
          v_net, p_external_ref, 'succeeded', 'stripe_webhook', now())
  RETURNING id INTO v_payment;

  -- Our revenue ledger: only the Stripe rail earns an application fee.
  IF p_application_fee_cents > 0 THEN
    INSERT INTO platform_fees (payment_id, application_fee_cents, connect_cost_cents,
                               net_revenue_cents, period)
    VALUES (v_payment, p_application_fee_cents, 0, p_application_fee_cents,
            to_char(now(), 'YYYY-MM'));
  END IF;

  INSERT INTO reconciliation_events (payment_id, source, external_ref)
  VALUES (v_payment, 'stripe_webhook', p_external_ref);

  RETURN jsonb_build_object('ok', true, 'payment_id', v_payment);
END $$;

-- Link a Stripe connected account to an org (called after onboarding).
CREATE OR REPLACE FUNCTION public.set_stripe_account(
  p_org uuid, p_external_ref text, p_status public.payment_account_status
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  v_id := ensure_payment_account(p_org);
  UPDATE payment_accounts
     SET external_ref = p_external_ref, status = p_status, updated_at = now()
   WHERE id = v_id;
  RETURN jsonb_build_object('ok', true, 'payment_account_id', v_id);
END $$;
