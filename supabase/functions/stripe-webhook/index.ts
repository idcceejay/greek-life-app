// Supabase Edge Function: stripe-webhook
//
// The only thing that may mark a charge paid. Stripe calls this; we verify the
// signature, then write the payment through record_stripe_payment (idempotent
// on the Stripe object id, so replays are harmless).
//
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
//          (--no-verify-jwt because Stripe calls it, not a signed-in user;
//           the Stripe signature is the auth.)
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
//
// In Stripe: add endpoint https://<project>.supabase.co/functions/v1/stripe-webhook
// listening for checkout.session.completed and account.updated.

import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (e) {
    return new Response(`Signature verification failed: ${e}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const chargeId = session.metadata?.charge_id;
        if (!chargeId) break;

        const gross = session.amount_total ?? 0;
        let processorFee = 0;
        let appFee = 0;

        // Pull the real fee numbers off the PaymentIntent's balance transaction.
        if (session.payment_intent) {
          const pi = await stripe.paymentIntents.retrieve(
            String(session.payment_intent),
            { expand: ['latest_charge.balance_transaction'] },
            { stripeAccount: event.account },
          );
          appFee = (pi as unknown as { application_fee_amount?: number })
            .application_fee_amount ?? 0;
          const latest = pi.latest_charge as unknown as {
            balance_transaction?: { fee?: number };
          } | null;
          processorFee = latest?.balance_transaction?.fee ?? 0;
        }

        await admin.rpc('record_stripe_payment', {
          p_charge: chargeId,
          p_external_ref: String(session.payment_intent ?? session.id),
          p_gross_cents: gross,
          p_processor_fee_cents: processorFee,
          p_application_fee_cents: appFee,
          p_channel: 'card',
        });
        break;
      }

      case 'account.updated': {
        // Chapter finished (or lost) Stripe onboarding — reflect it on the rail.
        const account = event.data.object as Stripe.Account;
        const orgId = account.metadata?.org_id;
        if (!orgId) break;
        const ready = account.charges_enabled && account.details_submitted;
        await admin.rpc('set_stripe_account', {
          p_org: orgId,
          p_external_ref: account.id,
          p_status: ready ? 'active' : 'pending',
        });
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    // Non-2xx tells Stripe to retry, which is what we want on a transient failure.
    return new Response(`Handler error: ${e}`, { status: 500 });
  }
});
