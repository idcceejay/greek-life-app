/**
 * Dues & payments data layer.
 *
 * `charges` is the ledger — who owes what. `payments` settle charges, and the
 * charge status is maintained by a database trigger, never written from here.
 * Stripe money movement goes through Edge Functions; this file only reads the
 * ledger and asks the server to start a checkout.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

export type ChargeStatus = 'unpaid' | 'partial' | 'paid' | 'waived' | 'void';
export type ChargeCategory =
  | 'national_dues'
  | 'local_dues'
  | 'social'
  | 'merch'
  | 'event'
  | 'fine';

export type MyCharge = {
  id: string;
  org_id: string;
  org_name: string;
  description: string | null;
  category: ChargeCategory;
  amount_cents: number;
  paid_cents: number;
  due_date: string | null;
  status: ChargeStatus;
  created_at: string;
};

export type MemberBalance = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  owed_cents: number;
  paid_cents: number;
  overdue: boolean;
};

export const money = (cents: number) =>
  `$${(Math.max(0, cents) / 100).toFixed(2)}`;

// ---------------------------------------------------------------------------
// Member: what do I owe?
// ---------------------------------------------------------------------------
export function useMyCharges() {
  const [charges, setCharges] = useState<MyCharge[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase.rpc('my_charges');
    setCharges((data as MyCharge[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const outstanding = charges
    .filter((c) => c.status === 'unpaid' || c.status === 'partial')
    .reduce((n, c) => n + (c.amount_cents - c.paid_cents), 0);

  return { charges, outstanding, loading, refresh };
}

// ---------------------------------------------------------------------------
// Treasurer: who owes what across the chapter?
// ---------------------------------------------------------------------------
export function useOrgDues(orgId: string | undefined) {
  const [members, setMembers] = useState<MemberBalance[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase.rpc('org_dues_summary', { p_org: orgId });
    setMembers((data as MemberBalance[]) ?? []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const totalOwed = members.reduce((n, m) => n + Math.max(0, m.owed_cents), 0);
  const totalPaid = members.reduce((n, m) => n + m.paid_cents, 0);

  return { members, totalOwed, totalPaid, loading, refresh };
}

// ---------------------------------------------------------------------------
// Treasurer actions
// ---------------------------------------------------------------------------
export async function createDuesCycle(
  orgId: string,
  name: string,
  amountCents: number,
  dueDate: string | null,
) {
  const { data, error } = await supabase.rpc('create_dues_cycle', {
    p_org: orgId,
    p_name: name,
    p_amount_cents: amountCents,
    p_due_date: dueDate,
  });
  if (error) return { ok: false as const, error: error.message };
  const res = data as { ok: boolean; error?: string; charges_created?: number };
  return res.ok
    ? { ok: true as const, created: res.charges_created ?? 0 }
    : { ok: false as const, error: res.error ?? 'unknown' };
}

export async function recordManualPayment(chargeId: string, amountCents: number, note?: string) {
  const { data, error } = await supabase.rpc('record_manual_payment', {
    p_charge: chargeId,
    p_amount_cents: amountCents,
    p_note: note ?? null,
  });
  if (error) return { ok: false as const, error: error.message };
  const res = data as { ok: boolean; error?: string };
  return res.ok ? { ok: true as const } : { ok: false as const, error: res.error ?? 'unknown' };
}

export async function setChargeStatus(chargeId: string, status: 'waived' | 'void' | 'unpaid') {
  const { data, error } = await supabase.rpc('set_charge_status', {
    p_charge: chargeId,
    p_status: status,
  });
  if (error) return { ok: false as const, error: error.message };
  const res = data as { ok: boolean; error?: string };
  return res.ok ? { ok: true as const } : { ok: false as const, error: res.error ?? 'unknown' };
}

/** All charges for one member in one org (treasurer drill-down). */
export async function chargesForMember(orgId: string, userId: string) {
  const { data } = await supabase
    .from('charges')
    .select('id, description, amount_cents, due_date, status, category')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .neq('status', 'void')
    .order('created_at', { ascending: false });
  return (data as Omit<MyCharge, 'org_id' | 'org_name' | 'paid_cents' | 'created_at'>[]) ?? [];
}

// ---------------------------------------------------------------------------
// Stripe (Edge Functions — secret key never touches the app)
// ---------------------------------------------------------------------------

/** Chapter onboarding: returns a Stripe-hosted URL to open in a browser. */
export async function startStripeOnboarding(orgId: string) {
  const { data, error } = await supabase.functions.invoke('stripe-connect-link', {
    body: { org_id: orgId, return_url: 'rally://dues' },
  });
  if (error) return { ok: false as const, error: error.message };
  const res = data as { ok: boolean; error?: string; url?: string };
  return res.ok
    ? { ok: true as const, url: res.url! }
    : { ok: false as const, error: res.error ?? 'unknown' };
}

/** Member payment: returns a Stripe Checkout URL for one charge. */
export async function startCheckout(chargeId: string) {
  const { data, error } = await supabase.functions.invoke('stripe-checkout', {
    body: { charge_id: chargeId, return_url: 'rally://dues' },
  });
  if (error) return { ok: false as const, error: error.message };
  const res = data as { ok: boolean; error?: string; url?: string };
  if (res.ok) return { ok: true as const, url: res.url! };
  const friendly =
    res.error === 'chapter_not_onboarded'
      ? "Your chapter hasn't finished setting up payments yet."
      : res.error === 'already_settled' || res.error === 'nothing_due'
        ? 'This charge is already paid.'
        : (res.error ?? 'Could not start checkout.');
  return { ok: false as const, error: friendly };
}

/** Is this org able to take card payments yet? */
export async function stripeStatus(orgId: string) {
  const { data } = await supabase
    .from('payment_accounts')
    .select('status, external_ref')
    .eq('org_id', orgId)
    .eq('rail', 'stripe_connect')
    .maybeSingle();
  const row = data as { status: string; external_ref: string | null } | null;
  return {
    connected: !!row?.external_ref,
    active: row?.status === 'active',
  };
}
