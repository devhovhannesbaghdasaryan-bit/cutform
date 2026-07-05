import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Server-only guard is a bundler-condition trick; tests run in plain node.
      'server-only': fileURLToPath(new URL('./tests/stubs/empty.ts', import.meta.url)),
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    },
  },
});
