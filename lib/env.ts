import { z } from 'zod';

// Treat empty strings as undefined so blank entries in .env.local don't trip
// `.optional()` validators (an empty string is "set", not missing).
const optionalNonEmpty = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalNonEmpty,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalNonEmpty,
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: optionalNonEmpty,
  SUPABASE_SERVICE_ROLE_KEY: optionalNonEmpty,
  OPENAI_API_KEY: optionalNonEmpty,
  OPENAI_IMAGE_MODEL: optionalNonEmpty,
  AMERIA_API_BASE_URL: optionalNonEmpty,
  AMERIA_CLIENT_ID: optionalNonEmpty,
  AMERIA_USERNAME: optionalNonEmpty,
  AMERIA_PASSWORD: optionalNonEmpty,
  AMERIA_ORDER_ID_BASE: optionalNonEmpty,
  EXCHANGE_RATE_API_URL: optionalNonEmpty,
  EXCHANGE_RATE_API_KEY: optionalNonEmpty,
  EXCHANGE_RATE_PROVIDER: optionalNonEmpty,
});

const publicEnvSchema = envSchema
  .pick({
    NEXT_PUBLIC_SUPABASE_URL: true,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: true,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
    NEXT_PUBLIC_SITE_URL: true,
  })
  .refine(
    (env) => env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { message: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required' },
  )
  .transform((env) => ({
    ...env,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  }));

export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

export function getServerEnv() {
  const env = envSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_IMAGE_MODEL: process.env.OPENAI_IMAGE_MODEL,
    AMERIA_API_BASE_URL: process.env.AMERIA_API_BASE_URL,
    AMERIA_CLIENT_ID: process.env.AMERIA_CLIENT_ID,
    AMERIA_USERNAME: process.env.AMERIA_USERNAME,
    AMERIA_PASSWORD: process.env.AMERIA_PASSWORD,
    AMERIA_ORDER_ID_BASE: process.env.AMERIA_ORDER_ID_BASE,
    EXCHANGE_RATE_API_URL: process.env.EXCHANGE_RATE_API_URL,
    EXCHANGE_RATE_API_KEY: process.env.EXCHANGE_RATE_API_KEY,
    EXCHANGE_RATE_PROVIDER: process.env.EXCHANGE_RATE_PROVIDER,
  });

  const publishableKey =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!publishableKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required');
  }

  return {
    ...env,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY,
  };
}
