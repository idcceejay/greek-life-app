// Supabase Edge Function: stripe-connect-link
//
// Creates (or reuses) a Stripe Connect Standard account for an organization and
// returns an onboarding URL. Treasurer/admin only.
//
// Deploy:  supabase functions deploy stripe-connect-link
// Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_test_...
//
// Standard accounts keep Stripe as the merchant of record — the chapter owns the
// account, we never hold funds, and our compliance surface stays minimal.

import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { org_id, return_url } = await req.json();

    // Caller identity comes from their JWT — never trust a user id in the body.
    const authed = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    );
    const { data: userData } = await authed.auth.getUser();
    if (!userData?.user) {
      return json({ ok: false, error: 'not_signed_in' }, 401);
    }

    // Must be admin/treasurer of this org.
    const { data: membership } = await authed
      .from('memberships')
      .select('role, status')
      .eq('org_id', org_id)
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (!membership || membership.status !== 'active' ||
        !['admin', 'treasurer'].includes(membership.role)) {
      return json({ ok: false, error: 'not_authorized' }, 403);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Reuse the org's connected account if it already exists.
    const { data: account } = await admin
      .from('payment_accounts')
      .select('id, external_ref')
      .eq('org_id', org_id)
      .eq('rail', 'stripe_connect')
      .maybeSingle();

    let acctId = account?.external_ref ?? null;
    if (!acctId) {
      const created = await stripe.accounts.create({
        type: 'standard',
        metadata: { org_id },
      });
      acctId = created.id;
      await admin.rpc('set_stripe_account', {
        p_org: org_id,
        p_external_ref: acctId,
        p_status: 'pending',
      });
    }

    const link = await stripe.accountLinks.create({
      account: acctId,
      refresh_url: return_url ?? 'rally://dues',
      return_url: return_url ?? 'rally://dues',
      type: 'account_onboarding',
    });

    return json({ ok: true, url: link.url, account_id: acctId });
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
