import 'server-only';

import { getServerEnv } from '@/lib/env';

// Feature flags are exact-string 'true' only; any other value = disabled.
export function isPolarEnabled(): boolean {
  return getServerEnv().POLAR_ENABLED === 'true';
}

export function isAmeriaEnabled(): boolean {
  return getServerEnv().AMERIA_ENABLED === 'true';
}
