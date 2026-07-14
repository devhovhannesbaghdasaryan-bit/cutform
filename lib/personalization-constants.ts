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

/**
 * The two laser-on-glass engraving styles offered per catalog item. `contour`
 * (hairline outline) is the default and uses the item's base price; `solid`
 * (dense scratched fill) is opt-in with its own admin-entered price and prompt.
 */
export const LASER_ENGRAVING_STYLES = ['contour', 'solid'] as const;
export type LaserEngravingStyle = (typeof LASER_ENGRAVING_STYLES)[number];

/**
 * Pre-filled default prompt for the solid-scratching style. Admins can edit it
 * per item; it is also the fallback when Solid is enabled without a saved prompt.
 */
export const DEFAULT_SOLID_ENGRAVING_PROMPT = [
  'Render the subject as a solid laser-scratched engraving on clear glass:',
  'fill the design with bold, solid frosted shapes rather than thin outlines,',
  'using dense, uniform white/frosted scratching over a transparent glass background.',
  'Maximize solid engraved coverage of the subject while preserving its recognizable form.',
  'Avoid hairline contours or open line work — use filled areas suited to raster laser engraving on glass.',
].join(' ');
