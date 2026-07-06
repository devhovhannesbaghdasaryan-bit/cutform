import 'server-only';

import { getServerEnv } from '@/lib/env';

// Master switch for the Polar route. While false, non-Armenia billing is
// blocked with a "temporarily unavailable" notice and no order is created.
// Polar itself is not integrated yet — see the follow-up spec.
export function isPolarEnabled(): boolean {
  return getServerEnv().POLAR_ENABLED === 'true';
}
