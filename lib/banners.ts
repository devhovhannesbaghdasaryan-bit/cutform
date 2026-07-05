import type { Tables } from '@/lib/supabase/types';

export type BannerSample = Pick<Tables<'banner_samples'>, 'id' | 'title' | 'image_path'>;

export type BannerPreset = Pick<
  Tables<'banner_size_presets'>,
  'key' | 'name' | 'width_mm' | 'height_mm' | 'material' | 'finish'
>;
