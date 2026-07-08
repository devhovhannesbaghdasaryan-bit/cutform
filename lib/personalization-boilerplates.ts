import type { SupabaseClient } from '@supabase/supabase-js';

export interface PersonalizationBoilerplate {
  id: string;
  name: string;
  image_path: string;
  openai_file_id: string;
  manufacturing_process: string;
  generation_instruction: string;
  generate_hidden_svg: boolean;
  is_active: boolean;
  sort_order: number;
}

interface CatalogItemBoilerplateRow {
  sort_order: number;
  boilerplate: PersonalizationBoilerplate | null;
}

/** Active boilerplates attached to a catalog item, in admin-configured order. */
export async function listCatalogItemBoilerplates(
  supabase: SupabaseClient,
  catalogItemId: string,
): Promise<PersonalizationBoilerplate[]> {
  const { data, error } = await supabase
    .from('catalog_item_boilerplates')
    .select(
      'sort_order, boilerplate:personalization_boilerplates(id, name, image_path, openai_file_id, manufacturing_process, generation_instruction, generate_hidden_svg, is_active, sort_order)',
    )
    .eq('catalog_item_id', catalogItemId)
    .order('sort_order', { ascending: true })
    .returns<CatalogItemBoilerplateRow[]>();

  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => row.boilerplate)
    .filter((boilerplate): boilerplate is PersonalizationBoilerplate =>
      Boolean(boilerplate?.is_active),
    );
}
