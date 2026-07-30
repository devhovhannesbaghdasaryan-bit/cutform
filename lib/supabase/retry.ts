// Retry helper for Supabase calls that fail for reasons outside our control
// (e.g. Supabase's gateway intermittently minting sb_secret JWTs with a
// future iat, which PostgREST rejects as "JWT issued at future"). Only
// errors on this allowlist are retried; anything else is a real bug and
// must fail loudly on the first attempt.
const TRANSIENT_ERROR_PATTERNS: readonly RegExp[] = [
  /JWT issued at future/i,
  /fetch failed/i,
  /ECONNRESET/i,
  /socket hang up/i,
  /ETIMEDOUT/i,
];

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 250;

export function isTransientSupabaseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return TRANSIENT_ERROR_PATTERNS.some((pattern) => pattern.test(error.message));
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function retryTransient<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS || !isTransientSupabaseError(error)) throw error;
      console.warn(
        '[retryTransient] attempt %d failed transiently: %s',
        attempt,
        error instanceof Error ? error.message : String(error),
      );
      const base = BASE_DELAY_MS * attempt; // 250ms, then 500ms
      const jitter = base * (Math.random() - 0.5); // ±50%
      await sleep(base + jitter);
    }
  }
  throw lastError; // Unreachable; satisfies the compiler.
}
