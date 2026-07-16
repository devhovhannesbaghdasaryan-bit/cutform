import 'server-only';
import { hasAdminPermission } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabase/server';

export const listCategoriesInputShape = {};

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
}

export async function handleListCategories(userId: string): Promise<CategorySummary[]> {
  const allowed = await hasAdminPermission(userId, 'catalog_manage', getServiceSupabase());
  if (!allowed) throw new Error('You are not authorized to manage the catalog.');

  const { data, error } = await getServiceSupabase()
    .from('categories')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .returns<CategorySummary[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}
