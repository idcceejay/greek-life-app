// Supabase Edge Function: stripe-checkout
//
// Creates a Stripe Checkout Session for one charge. The member pays; funds land
// in the chapter's connected account; our application fee is taken on top.
//
// Deploy:  supabase functions deploy stripe-checkout
// Secrets: STRIPE_SECRET_KEY
//
// Amounts are never taken from the client — we re-read the charge from the
// database so a tampered request can't change what's owed.

import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

/** Our take rate on the Stripe rail: 2% + $0.30 (see Launch-Plan §monetization). */
const APP_FEE_BPS = 200;
const APP_FEE_FLAT_CENTS = 30;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { charge_id, return_url } = await req.json();

    const authed = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    );
    const { data: userData } = await authed.auth.getUser();
    if (!userData?.user) return json({ ok: false, error: 'not_signed_in' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Authoritative charge, straight from the ledger.
    const { data: charge } = await admin
      .from('charges')
      .select('id, user_id, org_id, description, amount_cents, status, payment_account_id')
      .eq('id', charge_id)
      .maybeSingle();

    if (!charge) return json({ ok: false, error: 'no_such_charge' }, 404);
    if (charge.user_id !== userData.user.id) {
      return json({ ok: false, error: 'not_your_charge' }, 403);
    }
    if (!['unpaid', 'partial'].includes(charge.status)) {
      return json({ ok: false, error: 'already_settled' }, 409);
    }

    // How much is left on this charge?
    const { data: paid } = await admin
      .from('payments')
      .select('gross_cents')
      .eq('charge_id', charge.id)
      .eq('status', 'succeeded');
    const paidCents = (paid ?? []).reduce((n, p) => n + (p.gross_cents ?? 0), 0);
    const dueCents = Math.max(0, charge.amount_cents - paidCents);
    if (dueCents <= 0) return json({ ok: false, error: 'nothing_due' }, 409);

    const { data: account } = await admin
      .from('payment_accounts')
      .select('external_ref, status')
      .eq('id', charge.payment_account_id)
      .maybeSingle();

    if (!account?.external_ref || account.status !== 'active') {
      return json({ ok: false, error: 'chapter_not_onboarded' }, 409);
    }

    const appFee = Math.round((dueCents * APP_FEE_BPS) / 10000) + APP_FEE_FLAT_CENTS;

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: dueCents,
              product_data: { name: charge.description ?? 'Chapter dues' },
            },
          },
        ],
        payment_intent_data: { application_fee_amount: appFee },
        success_url: return_url ?? 'rally://dues?paid=1',
        cancel_url: return_url ?? 'rally://dues?canceled=1',
        metadata: { charge_id: charge.id, org_id: charge.org_id },
      },
      { stripeAccount: account.external_ref },
    );

    return json({ ok: true, url: session.url, due_cents: dueCents, fee_cents: appFee });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
