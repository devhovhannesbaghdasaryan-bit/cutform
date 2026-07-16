import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin', () => ({ requireAdminPermission: vi.fn() }));
vi.mock('@/lib/mcp/oauth-store', () => ({ revokeConnectedApp: vi.fn() }));
vi.mock('@/lib/transactions', () => ({ writeAdminAuditLog: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { requireAdminPermission } from '@/lib/admin';
import { revokeConnectedApp } from '@/lib/mcp/oauth-store';
import { writeAdminAuditLog } from '@/lib/transactions';
import { revokeConnectorAction } from '@/app/admin/connectors/actions';

const TOKEN_ID = '550e8400-e29b-41d4-a716-446655440002';

describe('revokeConnectorAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires catalog_manage before revoking', async () => {
    vi.mocked(requireAdminPermission).mockResolvedValue({
      supabase: {} as never,
      user: { id: 'user-1' } as never,
    });

    const formData = new FormData();
    formData.set('tokenId', TOKEN_ID);
    await revokeConnectorAction(formData);

    expect(requireAdminPermission).toHaveBeenCalledWith('catalog_manage');
    expect(revokeConnectedApp).toHaveBeenCalledWith(expect.anything(), 'user-1', TOKEN_ID);
  });

  it('writes an audit log entry after revoking', async () => {
    vi.mocked(requireAdminPermission).mockResolvedValue({
      supabase: {} as never,
      user: { id: 'user-1' } as never,
    });

    const formData = new FormData();
    formData.set('tokenId', TOKEN_ID);
    await revokeConnectorAction(formData);

    expect(writeAdminAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorUserId: 'user-1',
        action: 'admin_mcp_connector_revoked',
        entityType: 'mcp_oauth_token',
        entityId: TOKEN_ID,
      }),
    );
  });
});
