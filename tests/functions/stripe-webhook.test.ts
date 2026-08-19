/**
 * Tests for supabase/functions/stripe-webhook/index.ts.
 *
 * The function is Deno source that imports Stripe and supabase-js by URL and
 * registers itself with Deno.serve at module load. We stand up a fake `Deno`
 * global first, capture the handler Deno.serve receives, and let the aliases in
 * vitest.config.ts swap the URL imports for the doubles in tests/doubles.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  constructEventAsync,
  paymentIntentsRetrieve,
  resetStripeDouble,
  stripeConstructorArgs,
} from '../doubles/stripe';
import {
  adminRpc,
  createClientArgs,
  resetSupabaseAdminDouble,
} from '../doubles/supabase-admin';

const ENV: Record<string, string> = {
  STRIPE_SECRET_KEY: 'sk_test_123',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_123',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
};

type Handler = (req: Request) => Promise<Response>;
let handler: Handler;

// Module-load side effects happen once, before the per-test resets clear them.
let stripeInit: unknown[];
let adminInit: unknown[];

const post = (event: unknown, signature: string | null = 'sig_ok') =>
  handler(
    new Request('https://project.supabase.co/functions/v1/stripe-webhook', {
      method: 'POST',
      body: JSON.stringify(event),
      headers: signature ? { 'stripe-signature': signature } : {},
    }),
  );

const checkoutEvent = (
  session: Record<string, unknown>,
  account = 'acct_chapter',
) => ({
  type: 'checkout.session.completed',
  account,
  data: { object: session },
});

beforeAll(async () => {
  (globalThis as Record<string, unknown>).Deno = {
    env: { get: (key: string) => ENV[key] },
    serve: (fn: Handler) => {
      handler = fn;
    },
  };
  await import('../../supabase/functions/stripe-webhook/index.ts');
  stripeInit = stripeConstructorArgs[0];
  adminInit = createClientArgs[0];
});

beforeEach(() => {
  resetStripeDouble();
  resetSupabaseAdminDouble();
});

describe('startup', () => {
  it('builds the Stripe client from the secret and a fetch http client', () => {
    const [secret, opts] = stripeInit as [string, Record<string, unknown>];
    expect(secret).toBe('sk_test_123');
    expect(opts.apiVersion).toBe('2024-06-20');
    expect(opts.httpClient).toEqual({ kind: 'fetch-http-client' });
  });

  it('builds the admin client with the service role key, not the anon key', () => {
    expect(adminInit).toEqual([
      'https://project.supabase.co',
      'service-role-key',
    ]);
  });
});

describe('signature verification', () => {
  it('rejects an event whose signature does not verify and writes nothing', async () => {
    constructEventAsync.mockRejectedValue(new Error('no signatures found'));

    const res = await post(checkoutEvent({ id: 'cs_1' }), 'sig_forged');

    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Signature verification failed');
    expect(adminRpc).not.toHaveBeenCalled();
  });

  it('rejects a request with no stripe-signature header at all', async () => {
    constructEventAsync.mockRejectedValue(new Error('missing signature'));

    const res = await post(checkoutEvent({ id: 'cs_1' }), null);

    expect(res.status).toBe(400);
    expect(adminRpc).not.toHaveBeenCalled();
  });

  it('verifies against the raw body, the header, and the webhook secret', async () => {
    const event = checkoutEvent({ id: 'cs_1' });
    constructEventAsync.mockResolvedValue(event);

    await post(event);

    const [body, signature, secret] = constructEventAsync.mock.calls[0];
    expect(body).toBe(JSON.stringify(event));
    expect(signature).toBe('sig_ok');
    expect(secret).toBe('whsec_test_123');
  });
});

describe('checkout.session.completed', () => {
  const session = {
    id: 'cs_1',
    amount_total: 15000,
    payment_intent: 'pi_1',
    metadata: { charge_id: 'charge-abc' },
  };

  it('records the payment with the real processor and application fees', async () => {
    constructEventAsync.mockResolvedValue(checkoutEvent(session));
    paymentIntentsRetrieve.mockResolvedValue({
      application_fee_amount: 300,
      latest_charge: { balance_transaction: { fee: 465 } },
    });

    const res = await post(checkoutEvent(session));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(adminRpc).toHaveBeenCalledWith('record_stripe_payment', {
      p_charge: 'charge-abc',
      p_external_ref: 'pi_1',
      p_gross_cents: 15000,
      p_processor_fee_cents: 465,
      p_application_fee_cents: 300,
      p_channel: 'card',
    });
  });

  it('reads the payment intent on the connected account, not the platform', async () => {
    constructEventAsync.mockResolvedValue(checkoutEvent(session, 'acct_theta'));
    paymentIntentsRetrieve.mockResolvedValue({});

    await post(checkoutEvent(session, 'acct_theta'));

    expect(paymentIntentsRetrieve).toHaveBeenCalledWith(
      'pi_1',
      { expand: ['latest_charge.balance_transaction'] },
      { stripeAccount: 'acct_theta' },
    );
  });

  it('defaults both fees to zero when Stripe reports none', async () => {
    constructEventAsync.mockResolvedValue(checkoutEvent(session));
    paymentIntentsRetrieve.mockResolvedValue({ latest_charge: null });

    await post(checkoutEvent(session));

    expect(adminRpc.mock.calls[0][1]).toMatchObject({
      p_processor_fee_cents: 0,
      p_application_fee_cents: 0,
    });
  });

  it('falls back to the session id when there is no payment intent', async () => {
    const noPi = { ...session, payment_intent: null };
    constructEventAsync.mockResolvedValue(checkoutEvent(noPi));

    await post(checkoutEvent(noPi));

    expect(paymentIntentsRetrieve).not.toHaveBeenCalled();
    expect(adminRpc.mock.calls[0][1]).toMatchObject({
      p_external_ref: 'cs_1',
      p_processor_fee_cents: 0,
      p_application_fee_cents: 0,
    });
  });

  it('treats a missing amount_total as zero rather than NaN', async () => {
    const noAmount = { ...session, amount_total: null };
    constructEventAsync.mockResolvedValue(checkoutEvent(noAmount));
    paymentIntentsRetrieve.mockResolvedValue({});

    await post(checkoutEvent(noAmount));

    expect(adminRpc.mock.calls[0][1]).toMatchObject({ p_gross_cents: 0 });
  });

  it('ignores a session that carries no charge_id metadata', async () => {
    const orphan = { id: 'cs_orphan', amount_total: 500, payment_intent: 'pi_x' };
    constructEventAsync.mockResolvedValue(checkoutEvent(orphan));

    const res = await post(checkoutEvent(orphan));

    expect(res.status).toBe(200);
    expect(adminRpc).not.toHaveBeenCalled();
  });

  it('acks a replayed event the same way, leaving idempotency to the RPC', async () => {
    constructEventAsync.mockResolvedValue(checkoutEvent(session));
    paymentIntentsRetrieve.mockResolvedValue({});

    const first = await post(checkoutEvent(session));
    const second = await post(checkoutEvent(session));

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(adminRpc).toHaveBeenCalledTimes(2);
    expect(adminRpc.mock.calls[0][1]).toEqual(adminRpc.mock.calls[1][1]);
  });
});

describe('account.updated', () => {
  const accountEvent = (account: Record<string, unknown>) => ({
    type: 'account.updated',
    data: { object: account },
  });

  it('marks the rail active once charges are enabled and details submitted', async () => {
    const account = {
      id: 'acct_1',
      charges_enabled: true,
      details_submitted: true,
      metadata: { org_id: 'org-1' },
    };
    constructEventAsync.mockResolvedValue(accountEvent(account));

    const res = await post(accountEvent(account));

    expect(res.status).toBe(200);
    expect(adminRpc).toHaveBeenCalledWith('set_stripe_account', {
      p_org: 'org-1',
      p_external_ref: 'acct_1',
      p_status: 'active',
    });
  });

  it('stays pending while charges are still disabled', async () => {
    const account = {
      id: 'acct_1',
      charges_enabled: false,
      details_submitted: true,
      metadata: { org_id: 'org-1' },
    };
    constructEventAsync.mockResolvedValue(accountEvent(account));

    await post(accountEvent(account));

    expect(adminRpc.mock.calls[0][1]).toMatchObject({ p_status: 'pending' });
  });

  it('stays pending while onboarding details are unfinished', async () => {
    const account = {
      id: 'acct_1',
      charges_enabled: true,
      details_submitted: false,
      metadata: { org_id: 'org-1' },
    };
    constructEventAsync.mockResolvedValue(accountEvent(account));

    await post(accountEvent(account));

    expect(adminRpc.mock.calls[0][1]).toMatchObject({ p_status: 'pending' });
  });

  it('ignores an account that is not linked to an org', async () => {
    const account = { id: 'acct_1', charges_enabled: true, details_submitted: true };
    constructEventAsync.mockResolvedValue(accountEvent(account));

    const res = await post(accountEvent(account));

    expect(res.status).toBe(200);
    expect(adminRpc).not.toHaveBeenCalled();
  });
});

describe('other events', () => {
  it('acks an event type it does not handle without touching the database', async () => {
    const event = { type: 'payment_intent.succeeded', data: { object: {} } };
    constructEventAsync.mockResolvedValue(event);

    const res = await post(event);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(adminRpc).not.toHaveBeenCalled();
  });
});

describe('failures downstream of verification', () => {
  it('returns 500 so Stripe retries when the RPC blows up', async () => {
    const session = {
      id: 'cs_1',
      amount_total: 100,
      payment_intent: null,
      metadata: { charge_id: 'charge-abc' },
    };
    constructEventAsync.mockResolvedValue(checkoutEvent(session));
    adminRpc.mockRejectedValue(new Error('connection reset'));

    const res = await post(checkoutEvent(session));

    expect(res.status).toBe(500);
    expect(await res.text()).toContain('Handler error');
  });

  it('returns 500 when the payment intent lookup fails', async () => {
    const session = {
      id: 'cs_1',
      amount_total: 100,
      payment_intent: 'pi_1',
      metadata: { charge_id: 'charge-abc' },
    };
    constructEventAsync.mockResolvedValue(checkoutEvent(session));
    paymentIntentsRetrieve.mockRejectedValue(new Error('stripe down'));

    const res = await post(checkoutEvent(session));

    expect(res.status).toBe(500);
    expect(adminRpc).not.toHaveBeenCalled();
  });
});
