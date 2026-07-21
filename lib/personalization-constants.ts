export const PERSONALIZATION_TAGS = ['personal_color', 'personal_text', 'personal_photo'] as const;
export type PersonalizationTag = (typeof PERSONALIZATION_TAGS)[number];

export const COMFORTABLE_COLORS = [
  { value: 'warm_white', label: 'Warm white', hex: '#f7d7a1' },
  { value: 'soft_amber', label: 'Soft amber', hex: '#f4bf73' },
  { value: 'soft_peach', label: 'Soft peach', hex: '#f5b49f' },
  { value: 'mint', label: 'Mint', hex: '#a8dbc2' },
  { value: 'sky_blue', label: 'Sky blue', hex: '#9fcaea' },
] as const;

export const DEFAULT_COLOR_VALUE = 'warm_white';
export const MAX_PERSONALIZED_TEXT_LENGTH = 80;
export const MAX_PERSONALIZED_PHOTOS = 1;
