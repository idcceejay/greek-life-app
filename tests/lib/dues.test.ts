// @vitest-environment jsdom
/**
 * Tests for lib/dues.ts.
 *
 * lib/supabase is replaced wholesale so nothing here touches the network or the
 * React Native AsyncStorage adapter the real client is built with.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sb = vi.hoisted(() => {
  const state: { queryResult: { data: unknown; error: unknown } } = {
    queryResult: { data: null, error: null },
  };
  const rpc = vi.fn();
  const invoke = vi.fn();
  const chains: { table: string; calls: unknown[][] }[] = [];

  const from = vi.fn((table: string) => {
    const chain = { table, calls: [] as unknown[][] };
    chains.push(chain);
    const link =
      (name: string) =>
      (...args: unknown[]) => {
        chain.calls.push([name, ...args]);
        return builder;
      };
    const settle =
      (name: string) =>
      (...args: unknown[]) => {
        chain.calls.push([name, ...args]);
        return Promise.resolve(state.queryResult);
      };
    const builder: Record<string, unknown> = {
      select: link('select'),
      eq: link('eq'),
      neq: link('neq'),
      order: settle('order'),
      maybeSingle: settle('maybeSingle'),
    };
    return builder;
  });

  return { state, rpc, invoke, from, chains };
});

vi.mock('../../lib/supabase', () => ({
  supabaseConfigured: true,
  supabase: {
    rpc: sb.rpc,
    from: sb.from,
    functions: { invoke: sb.invoke },
  },
}));

import {
  chargesForMember,
  createDuesCycle,
  money,
  recordManualPayment,
  setChargeStatus,
  startCheckout,
  startStripeOnboarding,
  stripeStatus,
  useMyCharges,
  useOrgDues,
  type MyCharge,
  type MemberBalance,
} from '../../lib/dues';

const charge = (over: Partial<MyCharge> = {}): MyCharge => ({
  id: 'c1',
  org_id: 'org-1',
  org_name: 'Theta',
  description: 'Fall dues',
  category: 'local_dues',
  amount_cents: 10000,
  paid_cents: 0,
  due_date: '2026-09-01',
  status: 'unpaid',
  created_at: '2026-08-01T00:00:00Z',
  ...over,
});

const member = (over: Partial<MemberBalance> = {}): MemberBalance => ({
  user_id: 'u1',
  full_name: 'Ada',
  username: 'ada',
  owed_cents: 0,
  paid_cents: 0,
  overdue: false,
  ...over,
});

beforeEach(() => {
  sb.rpc.mockReset();
  sb.invoke.mockReset();
  sb.from.mockClear();
  sb.chains.length = 0;
  sb.state.queryResult = { data: null, error: null };
});

// ---------------------------------------------------------------------------
describe('money', () => {
  it('formats whole and fractional dollars', () => {
    expect(money(0)).toBe('$0.00');
    expect(money(1)).toBe('$0.01');
    expect(money(99)).toBe('$0.99');
    expect(money(10000)).toBe('$100.00');
    expect(money(123456)).toBe('$1234.56');
  });

  it('clamps a negative balance (a credit) to zero instead of showing -$', () => {
    expect(money(-1)).toBe('$0.00');
    expect(money(-25000)).toBe('$0.00');
  });
});

// ---------------------------------------------------------------------------
describe('useMyCharges', () => {
  it('loads the ledger and clears the loading flag', async () => {
    sb.rpc.mockResolvedValue({ data: [charge()], error: null });

    const { result } = renderHook(() => useMyCharges());
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(sb.rpc).toHaveBeenCalledWith('my_charges');
    expect(result.current.charges).toHaveLength(1);
  });

  it('renders an empty ledger when the RPC returns null', async () => {
    sb.rpc.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useMyCharges());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.charges).toEqual([]);
    expect(result.current.outstanding).toBe(0);
  });

  it('counts only unpaid and partial charges toward the outstanding total', async () => {
    sb.rpc.mockResolvedValue({
      data: [
        charge({ id: 'a', status: 'unpaid', amount_cents: 10000, paid_cents: 0 }),
        charge({ id: 'b', status: 'partial', amount_cents: 8000, paid_cents: 3000 }),
        charge({ id: 'c', status: 'paid', amount_cents: 5000, paid_cents: 5000 }),
        charge({ id: 'd', status: 'waived', amount_cents: 4000, paid_cents: 0 }),
        charge({ id: 'e', status: 'void', amount_cents: 9000, paid_cents: 0 }),
      ],
      error: null,
    });

    const { result } = renderHook(() => useMyCharges());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.outstanding).toBe(15000);
  });

  it('recomputes the outstanding total after a manual refresh', async () => {
    sb.rpc.mockResolvedValue({
      data: [charge({ amount_cents: 10000, paid_cents: 0 })],
      error: null,
    });
    const { result } = renderHook(() => useMyCharges());
    await waitFor(() => expect(result.current.outstanding).toBe(10000));

    sb.rpc.mockResolvedValue({
      data: [charge({ status: 'paid', amount_cents: 10000, paid_cents: 10000 })],
      error: null,
    });
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.outstanding).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('useOrgDues', () => {
  it('does not query at all until an org id is known', async () => {
    const { result } = renderHook(() => useOrgDues(undefined));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(sb.rpc).not.toHaveBeenCalled();
    expect(result.current.members).toEqual([]);
    expect(result.current.totalOwed).toBe(0);
    expect(result.current.totalPaid).toBe(0);
  });

  it('summarises the chapter once the org id arrives', async () => {
    sb.rpc.mockResolvedValue({
      data: [
        member({ user_id: 'u1', owed_cents: 10000, paid_cents: 2500 }),
        member({ user_id: 'u2', owed_cents: 5000, paid_cents: 0 }),
      ],
      error: null,
    });

    const { result } = renderHook(() => useOrgDues('org-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(sb.rpc).toHaveBeenCalledWith('org_dues_summary', { p_org: 'org-1' });
    expect(result.current.totalOwed).toBe(15000);
    expect(result.current.totalPaid).toBe(2500);
  });

  it('ignores overpayment credits in the owed total but keeps them in paid', async () => {
    sb.rpc.mockResolvedValue({
      data: [
        member({ user_id: 'u1', owed_cents: -2000, paid_cents: 12000 }),
        member({ user_id: 'u2', owed_cents: 3000, paid_cents: 1000 }),
      ],
      error: null,
    });

    const { result } = renderHook(() => useOrgDues('org-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.totalOwed).toBe(3000);
    expect(result.current.totalPaid).toBe(13000);
  });

  it('refetches when the org id changes', async () => {
    sb.rpc.mockResolvedValue({ data: [], error: null });
    const { result, rerender } = renderHook(({ id }) => useOrgDues(id), {
      initialProps: { id: 'org-1' as string | undefined },
    });
    await waitFor(() => expect(sb.rpc).toHaveBeenCalledTimes(1));

    rerender({ id: 'org-2' });

    await waitFor(() => expect(sb.rpc).toHaveBeenCalledTimes(2));
    expect(sb.rpc).toHaveBeenLastCalledWith('org_dues_summary', { p_org: 'org-2' });
    expect(result.current.members).toEqual([]);
  });

  it('renders empty when the summary RPC returns null', async () => {
    sb.rpc.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useOrgDues('org-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.members).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe('createDuesCycle', () => {
  it('passes the cycle through and reports how many charges were raised', async () => {
    sb.rpc.mockResolvedValue({ data: { ok: true, charges_created: 42 }, error: null });

    const res = await createDuesCycle('org-1', 'Fall 2026', 25000, '2026-09-15');

    expect(sb.rpc).toHaveBeenCalledWith('create_dues_cycle', {
      p_org: 'org-1',
      p_name: 'Fall 2026',
      p_amount_cents: 25000,
      p_due_date: '2026-09-15',
    });
    expect(res).toEqual({ ok: true, created: 42 });
  });

  it('accepts a cycle with no due date', async () => {
    sb.rpc.mockResolvedValue({ data: { ok: true, charges_created: 1 }, error: null });

    await createDuesCycle('org-1', 'Rolling', 100, null);

    expect(sb.rpc.mock.calls[0][1]).toMatchObject({ p_due_date: null });
  });

  it('reports zero created when the RPC omits the count', async () => {
    sb.rpc.mockResolvedValue({ data: { ok: true }, error: null });

    expect(await createDuesCycle('org-1', 'Fall', 100, null)).toEqual({
      ok: true,
      created: 0,
    });
  });

  it('surfaces a business rejection from the RPC payload', async () => {
    sb.rpc.mockResolvedValue({ data: { ok: false, error: 'not_treasurer' }, error: null });

    expect(await createDuesCycle('org-1', 'Fall', 100, null)).toEqual({
      ok: false,
      error: 'not_treasurer',
    });
  });

  it('surfaces a transport error without reading the payload', async () => {
    sb.rpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });

    expect(await createDuesCycle('org-1', 'Fall', 100, null)).toEqual({
      ok: false,
      error: 'permission denied',
    });
  });

  it('falls back to "unknown" when the RPC rejects without a reason', async () => {
    sb.rpc.mockResolvedValue({ data: { ok: false }, error: null });

    expect(await createDuesCycle('org-1', 'Fall', 100, null)).toEqual({
      ok: false,
      error: 'unknown',
    });
  });
});

// ---------------------------------------------------------------------------
describe('recordManualPayment', () => {
  it('sends the charge, amount, and note', async () => {
    sb.rpc.mockResolvedValue({ data: { ok: true }, error: null });

    const res = await recordManualPayment('charge-1', 5000, 'Venmo from Ada');

    expect(sb.rpc).toHaveBeenCalledWith('record_manual_payment', {
      p_charge: 'charge-1',
      p_amount_cents: 5000,
      p_note: 'Venmo from Ada',
    });
    expect(res).toEqual({ ok: true });
  });

  it('sends an explicit null when no note is given', async () => {
    sb.rpc.mockResolvedValue({ data: { ok: true }, error: null });

    await recordManualPayment('charge-1', 5000);

    expect(sb.rpc.mock.calls[0][1]).toMatchObject({ p_note: null });
  });

  it('reports a rejection and a transport error', async () => {
    sb.rpc.mockResolvedValueOnce({ data: { ok: false, error: 'charge_void' }, error: null });
    expect(await recordManualPayment('c', 1)).toEqual({ ok: false, error: 'charge_void' });

    sb.rpc.mockResolvedValueOnce({ data: null, error: { message: 'network' } });
    expect(await recordManualPayment('c', 1)).toEqual({ ok: false, error: 'network' });
  });
});

// ---------------------------------------------------------------------------
describe('setChargeStatus', () => {
  it.each(['waived', 'void', 'unpaid'] as const)('sends %s to the RPC', async (status) => {
    sb.rpc.mockResolvedValue({ data: { ok: true }, error: null });

    expect(await setChargeStatus('charge-1', status)).toEqual({ ok: true });
    expect(sb.rpc).toHaveBeenCalledWith('set_charge_status', {
      p_charge: 'charge-1',
      p_status: status,
    });
  });

  it('reports a rejection and a transport error', async () => {
    sb.rpc.mockResolvedValueOnce({ data: { ok: false, error: 'not_treasurer' }, error: null });
    expect(await setChargeStatus('c', 'waived')).toEqual({
      ok: false,
      error: 'not_treasurer',
    });

    sb.rpc.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
    expect(await setChargeStatus('c', 'void')).toEqual({ ok: false, error: 'offline' });
  });
});

// ---------------------------------------------------------------------------
describe('chargesForMember', () => {
  it('scopes to the org and member, hides void charges, and sorts newest first', async () => {
    sb.state.queryResult = { data: [{ id: 'c1' }], error: null };

    const rows = await chargesForMember('org-1', 'user-9');

    expect(sb.from).toHaveBeenCalledWith('charges');
    expect(sb.chains[0].calls).toEqual([
      ['select', 'id, description, amount_cents, due_date, status, category'],
      ['eq', 'org_id', 'org-1'],
      ['eq', 'user_id', 'user-9'],
      ['neq', 'status', 'void'],
      ['order', 'created_at', { ascending: false }],
    ]);
    expect(rows).toEqual([{ id: 'c1' }]);
  });

  it('returns an empty list when RLS hides everything', async () => {
    sb.state.queryResult = { data: null, error: null };

    expect(await chargesForMember('org-1', 'user-9')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe('startStripeOnboarding', () => {
  it('returns the hosted onboarding url', async () => {
    sb.invoke.mockResolvedValue({
      data: { ok: true, url: 'https://connect.stripe.com/setup/x' },
      error: null,
    });

    const res = await startStripeOnboarding('org-1');

    expect(sb.invoke).toHaveBeenCalledWith('stripe-connect-link', {
      body: { org_id: 'org-1', return_url: 'rally://dues' },
    });
    expect(res).toEqual({ ok: true, url: 'https://connect.stripe.com/setup/x' });
  });

  it('reports a function-level error', async () => {
    sb.invoke.mockResolvedValue({ data: null, error: { message: 'boom' } });

    expect(await startStripeOnboarding('org-1')).toEqual({ ok: false, error: 'boom' });
  });

  it('reports a rejection from the function payload', async () => {
    sb.invoke.mockResolvedValue({ data: { ok: false, error: 'not_admin' }, error: null });

    expect(await startStripeOnboarding('org-1')).toEqual({ ok: false, error: 'not_admin' });
  });

  it('falls back to "unknown" when the payload gives no reason', async () => {
    sb.invoke.mockResolvedValue({ data: { ok: false }, error: null });

    expect(await startStripeOnboarding('org-1')).toEqual({ ok: false, error: 'unknown' });
  });
});

// ---------------------------------------------------------------------------
describe('startCheckout', () => {
  it('returns the checkout url for the charge', async () => {
    sb.invoke.mockResolvedValue({
      data: { ok: true, url: 'https://checkout.stripe.com/c/pay/1' },
      error: null,
    });

    const res = await startCheckout('charge-1');

    expect(sb.invoke).toHaveBeenCalledWith('stripe-checkout', {
      body: { charge_id: 'charge-1', return_url: 'rally://dues' },
    });
    expect(res).toEqual({ ok: true, url: 'https://checkout.stripe.com/c/pay/1' });
  });

  it('explains an un-onboarded chapter in plain language', async () => {
    sb.invoke.mockResolvedValue({
      data: { ok: false, error: 'chapter_not_onboarded' },
      error: null,
    });

    expect(await startCheckout('charge-1')).toEqual({
      ok: false,
      error: "Your chapter hasn't finished setting up payments yet.",
    });
  });

  it.each(['already_settled', 'nothing_due'])(
    'explains %s as an already-paid charge',
    async (code) => {
      sb.invoke.mockResolvedValue({ data: { ok: false, error: code }, error: null });

      expect(await startCheckout('charge-1')).toEqual({
        ok: false,
        error: 'This charge is already paid.',
      });
    },
  );

  it('passes an unrecognised code straight through', async () => {
    sb.invoke.mockResolvedValue({ data: { ok: false, error: 'rate_limited' }, error: null });

    expect(await startCheckout('charge-1')).toEqual({ ok: false, error: 'rate_limited' });
  });

  it('uses a generic message when the function gives no reason', async () => {
    sb.invoke.mockResolvedValue({ data: { ok: false }, error: null });

    expect(await startCheckout('charge-1')).toEqual({
      ok: false,
      error: 'Could not start checkout.',
    });
  });

  it('reports a transport error before any friendly mapping', async () => {
    sb.invoke.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });

    expect(await startCheckout('charge-1')).toEqual({
      ok: false,
      error: 'Failed to fetch',
    });
  });
});

// ---------------------------------------------------------------------------
describe('stripeStatus', () => {
  it('queries the stripe_connect rail for the org', async () => {
    sb.state.queryResult = { data: { status: 'active', external_ref: 'acct_1' }, error: null };

    await stripeStatus('org-1');

    expect(sb.from).toHaveBeenCalledWith('payment_accounts');
    expect(sb.chains[0].calls).toEqual([
      ['select', 'status, external_ref'],
      ['eq', 'org_id', 'org-1'],
      ['eq', 'rail', 'stripe_connect'],
      ['maybeSingle'],
    ]);
  });

  it('is connected and active once Stripe says the account is live', async () => {
    sb.state.queryResult = { data: { status: 'active', external_ref: 'acct_1' }, error: null };

    expect(await stripeStatus('org-1')).toEqual({ connected: true, active: true });
  });

  it('is connected but inactive while onboarding is pending', async () => {
    sb.state.queryResult = { data: { status: 'pending', external_ref: 'acct_1' }, error: null };

    expect(await stripeStatus('org-1')).toEqual({ connected: true, active: false });
  });

  it('is not connected when the row exists without a Stripe account id', async () => {
    sb.state.queryResult = { data: { status: 'pending', external_ref: null }, error: null };

    expect(await stripeStatus('org-1')).toEqual({ connected: false, active: false });
  });

  it('is not connected when no rail row exists at all', async () => {
    sb.state.queryResult = { data: null, error: null };

    expect(await stripeStatus('org-1')).toEqual({ connected: false, active: false });
  });
});
