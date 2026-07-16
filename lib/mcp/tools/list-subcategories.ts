import 'server-only';
import { z } from 'zod';
import { hasAdminPermission } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabase/server';
import type { CategorySummary } from '@/lib/mcp/tools/list-categories';

export const listSubcategoriesInputShape = {
  categoryId: z.string().uuid().describe('A category id from list_categories.'),
};

const listSubcategoriesInputSchema = z.object(listSubcategoriesInputShape);

export async function handleListSubcategories(
  rawInput: unknown,
  userId: string,
): Promise<CategorySummary[]> {
  const input = listSubcategoriesInputSchema.parse(rawInput);

  const allowed = await hasAdminPermission(userId, 'catalog_manage', getServiceSupabase());
  if (!allowed) throw new Error('You are not authorized to manage the catalog.');

  const { data, error } = await getServiceSupabase()
    .from('subcategories')
    .select('id, name, slug')
    .eq('category_id', input.categoryId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .returns<CategorySummary[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}
