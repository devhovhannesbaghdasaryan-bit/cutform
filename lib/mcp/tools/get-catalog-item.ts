import 'server-only';
import { z } from 'zod';
import { hasAdminPermission } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabase/server';

export const getCatalogItemInputShape = {
  id: z.string().uuid().describe('The catalog item id returned by create_catalog_item.'),
};

const getCatalogItemInputSchema = z.object(getCatalogItemInputShape);

const CATALOG_ITEM_COLUMNS =
  'id, title, slug, status, price_cents, description, category_id, subcategory_id, thumbnail_path, manufacturing_notes, characteristics, tags, is_popular, is_customizable, system_prompt, skill_id, sizes';

export interface CatalogItemSummary {
  id: string;
  title: string;
  slug: string;
  status: string;
  price_cents: number;
  description: string | null;
  category_id: string;
  subcategory_id: string | null;
  thumbnail_path: string | null;
  manufacturing_notes: string | null;
  characteristics: string | null;
  tags: string[];
  is_popular: boolean;
  is_customizable: boolean;
  system_prompt: string | null;
  skill_id: string | null;
  sizes: unknown;
}

export async function handleGetCatalogItem(
  rawInput: unknown,
  userId: string,
): Promise<CatalogItemSummary> {
  const input = getCatalogItemInputSchema.parse(rawInput);

  const allowed = await hasAdminPermission(userId, 'catalog_manage', getServiceSupabase());
  if (!allowed) throw new Error('You are not authorized to manage the catalog.');

  const { data, error } = await getServiceSupabase()
    .from('catalog_items')
    .select(CATALOG_ITEM_COLUMNS)
    .eq('id', input.id)
    .maybeSingle<CatalogItemSummary>();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Catalog item ${input.id} not found.`);
  return data;
}
