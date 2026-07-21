import { z } from 'zod';

// Treat empty strings as undefined so blank entries in .env.local don't trip
// `.optional()` validators (an empty string is "set", not missing).
const optionalNonEmpty = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

// Single source of truth for env keys: each key literal appears exactly once.
// `publicShape` holds the keys exposed to the client via `publicEnv`;
// `serverShape` extends it with everything else `getServerEnv()` returns.
const publicShape = {
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalNonEmpty,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalNonEmpty,
  NEXT_PUBLIC_SITE_URL: z.string().url(),
};

const serverShape = {
  ...publicShape,
  SUPABASE_SECRET_KEY: optionalNonEmpty,
  SUPABASE_SERVICE_ROLE_KEY: optionalNonEmpty,
  OPENAI_API_KEY: optionalNonEmpty,
  OPENAI_IMAGE_MODEL: optionalNonEmpty,
  OPENAI_RESPONSES_MODEL: optionalNonEmpty,
  AMERIA_API_BASE_URL: optionalNonEmpty,
  AMERIA_CLIENT_ID: optionalNonEmpty,
  AMERIA_USERNAME: optionalNonEmpty,
  AMERIA_PASSWORD: optionalNonEmpty,
  AMERIA_ORDER_ID_BASE: optionalNonEmpty,
  POLAR_ENABLED: optionalNonEmpty,
  POLAR_ACCESS_TOKEN: optionalNonEmpty,
  POLAR_WEBHOOK_SECRET: optionalNonEmpty,
  POLAR_SERVER: optionalNonEmpty,
  POLAR_PRODUCT_ID_AMD: optionalNonEmpty,
  POLAR_PRODUCT_ID_EUR: optionalNonEmpty,
  POLAR_PRODUCT_ID_USD: optionalNonEmpty,
  AMERIA_ENABLED: optionalNonEmpty,
  EXCHANGE_RATE_API_URL: optionalNonEmpty,
  EXCHANGE_RATE_API_KEY: optionalNonEmpty,
  EXCHANGE_RATE_PROVIDER: optionalNonEmpty,
};

// Cross-field fallback shared by both parse paths: prefer the new publishable
// key, fall back to the legacy anon key, and fail loudly when neither is set.
// Zod does not catch exceptions thrown in transforms, so the plain Error (and
// its exact message) propagates to the caller.
function applySupabaseKeyFallback<
  T extends {
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  },
>(env: T) {
  const publishableKey =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!publishableKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required');
  }
  return { ...env, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey };
}

const publicEnvSchema = z.object(publicShape).transform(applySupabaseKeyFallback);

const serverEnvSchema = z
  .object(serverShape)
  .transform(applySupabaseKeyFallback)
  .transform((env) => ({
    ...env,
    SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY,
  }));

// The literal `process.env.NEXT_PUBLIC_*` member accesses below are required:
// the Next.js compiler statically inlines them into the client bundle, so this
// input object cannot be built dynamically (e.g. from the schema's keys).
export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

// Env is static per process, so parse once and reuse the result. (Tests reset
// module state via vi.resetModules(), which also resets this cache.)
let serverEnv: z.infer<typeof serverEnvSchema> | null = null;

export function getServerEnv() {
  // Server code can read process.env wholesale; z.object strips unknown keys.
  serverEnv ??= serverEnvSchema.parse(process.env);
  return serverEnv;
}
