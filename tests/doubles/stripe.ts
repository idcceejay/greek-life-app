import { vi } from 'vitest';

export const constructEventAsync = vi.fn();
export const paymentIntentsRetrieve = vi.fn();

/** Records the options the edge function passed to the Stripe constructor. */
export const stripeConstructorArgs: unknown[][] = [];

export default class StripeDouble {
  webhooks = { constructEventAsync };
  paymentIntents = { retrieve: paymentIntentsRetrieve };

  constructor(...args: unknown[]) {
    stripeConstructorArgs.push(args);
  }

  static createFetchHttpClient() {
    return { kind: 'fetch-http-client' };
  }

  static createSubtleCryptoProvider() {
    return { kind: 'subtle-crypto-provider' };
  }
}

export function resetStripeDouble() {
  constructEventAsync.mockReset();
  paymentIntentsRetrieve.mockReset();
  stripeConstructorArgs.length = 0;
}
