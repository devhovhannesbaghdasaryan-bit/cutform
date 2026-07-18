import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin', () => ({ requireAdminPermission: vi.fn() }));
vi.mock('@/lib/credits', () => ({ adjustCredits: vi.fn() }));
vi.mock('@/lib/transactions', () => ({ writeAdminAuditLog: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { requireAdminPermission } from '@/lib/admin';
import { adjustCredits } from '@/lib/credits';
import { getServiceSupabase } from '@/lib/supabase/server';
import { adjustAdminUserCreditsAction } from '@/app/admin/users/actions';

const USER_ID = '550e8400-e29b-41d4-a716-446655440002';

describe('adjustAdminUserCreditsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes the balance via the service-role client, not the cookie-bound admin session client', async () => {
    const sessionClient = { marker: 'session' } as never;
    const serviceClient = { marker: 'service' } as never;

    vi.mocked(requireAdminPermission).mockResolvedValue({
      supabase: sessionClient,
      user: { id: 'admin-1' } as never,
    });
    vi.mocked(getServiceSupabase).mockReturnValue(serviceClient);
    vi.mocked(adjustCredits).mockResolvedValue({ balance: 100, ledgerId: 'ledger-1' });

    const formData = new FormData();
    formData.set('userId', USER_ID);
    formData.set('direction', 'credit');
    formData.set('amount', '50');
    formData.set('reason', 'Manual top-up');

    await adjustAdminUserCreditsAction(formData);

    // credit_accounts/credit_ledger have no write RLS policy for the
    // authenticated admin session — only the service-role client bypasses
    // RLS, so the balance mutation must go through it.
    expect(adjustCredits).toHaveBeenCalledWith(serviceClient, expect.objectContaining({
      userId: USER_ID,
      delta: 50,
    }));
    expect(adjustCredits).not.toHaveBeenCalledWith(sessionClient, expect.anything());
  });
});
