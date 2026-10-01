import { defineConfig } from 'vitest/config';
import path from 'node:path';

const here = (p: string) => path.resolve(process.cwd(), p);

export default defineConfig({
  resolve: {
    // The edge function runs on Deno and imports by URL. Point those specifiers
    // at local doubles so the same source file can be exercised under Node.
    alias: [
      { find: 'https://esm.sh/stripe@14.21.0?target=deno', replacement: here('tests/doubles/stripe.ts') },
      { find: 'https://esm.sh/@supabase/supabase-js@2.45.0', replacement: here('tests/doubles/supabase-admin.ts') },
    ],
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
  },
});
