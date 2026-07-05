import type { Tables, TypedSupabaseClient } from '@/lib/supabase/types';

export type BannerSample = Pick<Tables<'banner_samples'>, 'id' | 'title' | 'image_path'>;

export type BannerPreset = Pick<
  Tables<'banner_size_presets'>,
  'key' | 'name' | 'width_mm' | 'height_mm' | 'material' | 'finish'
>;

export async function listBannerSamples(supabase: TypedSupabaseClient) {
  return supabase
    .from('banner_samples')
    .select('id, title, image_path')
    .eq('status', 'published')
    .order('created_at', { ascending: false });
}

export async function listBannerSizePresets(supabase: TypedSupabaseClient) {
  return supabase
    .from('banner_size_presets')
    .select('key, name, width_mm, height_mm, material, finish')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
}
