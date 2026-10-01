import { vi } from 'vitest';

export const adminRpc =
  vi.fn<(fn: string, args: Record<string, unknown>) => Promise<unknown>>(
    async () => ({ data: null, error: null }),
  );

/** Records the (url, serviceRoleKey) the edge function built its client with. */
export const createClientArgs: unknown[][] = [];

export function createClient(...args: unknown[]) {
  createClientArgs.push(args);
  return { rpc: adminRpc };
}

export function resetSupabaseAdminDouble() {
  adminRpc.mockReset();
  adminRpc.mockResolvedValue({ data: null, error: null });
  createClientArgs.length = 0;
}
