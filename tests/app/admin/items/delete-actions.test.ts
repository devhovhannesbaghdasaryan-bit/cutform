import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin', () => ({ requireAdminPermission: vi.fn() }));
vi.mock('@/lib/catalog-items/core', () => ({ deleteCatalogItemsCore: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { requireAdminPermission } from '@/lib/admin';
import { deleteCatalogItemsCore } from '@/lib/catalog-items/core';
import { deleteCatalogItemsAction } from '@/app/admin/items/actions';
import { idleState } from '@/lib/action-state';

const MUG = '550e8400-e29b-41d4-a716-446655440001';
const HAT = '550e8400-e29b-41d4-a716-446655440002';

function formDataWith(ids: string[]) {
  const formData = new FormData();
  for (const id of ids) formData.append('itemIds', id);
  return formData;
}

describe('deleteCatalogItemsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdminPermission).mockResolvedValue({
      supabase: { marker: 'session' } as never,
      user: { id: 'admin-1' } as never,
    });
  });

  it('rejects an empty selection without authenticating or touching the database', async () => {
    const state = await deleteCatalogItemsAction(idleState, formDataWith([]));

    expect(state.status).toBe('error');
    expect(deleteCatalogItemsCore).not.toHaveBeenCalled();
    expect(requireAdminPermission).not.toHaveBeenCalled();
  });

  it('rejects ids that are not uuids', async () => {
    const state = await deleteCatalogItemsAction(idleState, formDataWith([MUG, 'not-a-uuid']));

    expect(state.status).toBe('error');
    expect(deleteCatalogItemsCore).not.toHaveBeenCalled();
  });

  it('requires the catalog_manage permission', async () => {
    vi.mocked(deleteCatalogItemsCore).mockResolvedValue({ deleted: 1, blocked: [] });

    await deleteCatalogItemsAction(idleState, formDataWith([MUG]));

    expect(requireAdminPermission).toHaveBeenCalledWith('catalog_manage');
  });

  it('reports a clean delete', async () => {
    vi.mocked(deleteCatalogItemsCore).mockResolvedValue({ deleted: 2, blocked: [] });

    const state = await deleteCatalogItemsAction(idleState, formDataWith([MUG, HAT]));

    expect(state).toMatchObject({ status: 'success', message: 'Deleted 2 items.' });
  });

  it('names the items kept because an order references them', async () => {
    vi.mocked(deleteCatalogItemsCore).mockResolvedValue({
      deleted: 1,
      blocked: [{ id: MUG, title: 'Blue Mug' }],
    });

    const state = await deleteCatalogItemsAction(idleState, formDataWith([MUG, HAT]));

    expect(state.status).toBe('success');
    expect(state.status === 'success' && state.message).toBe(
      'Deleted 1 item. 1 item is used in an order and was kept: Blue Mug.',
    );
  });

  it('surfaces a core failure as an error state', async () => {
    vi.mocked(deleteCatalogItemsCore).mockRejectedValue(new Error('permission denied'));

    const state = await deleteCatalogItemsAction(idleState, formDataWith([MUG]));

    expect(state).toEqual({ status: 'error', error: 'permission denied' });
  });
});
