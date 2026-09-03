import { describe, expect, it } from 'vitest';
import { getCatalogPreviewPath, isSvgPath } from '@/lib/catalog-media';
import type { CatalogItemMedia } from '@/lib/marketplace';

function media(overrides: Partial<CatalogItemMedia> & Pick<CatalogItemMedia, 'id'>) {
  return {
    media_type: 'image',
    storage_path: `${overrides.id}.png`,
    alt_text: null,
    poster_path: null,
    sort_order: 0,
    is_primary: false,
    ...overrides,
  } satisfies CatalogItemMedia;
}

describe('getCatalogPreviewPath', () => {
  it('prefers the thumbnail over gallery media', () => {
    const path = getCatalogPreviewPath({
      thumbnail_path: 'user/thumbnails/cover.png',
      media: [media({ id: 'a', storage_path: 'user/media/a.png' })],
    });

    expect(path).toBe('user/thumbnails/cover.png');
  });

  it('falls back to the first sorted image when there is no thumbnail', () => {
    const path = getCatalogPreviewPath({
      thumbnail_path: null,
      media: [
        media({ id: 'b', storage_path: 'second.png', sort_order: 2 }),
        media({ id: 'a', storage_path: 'first.png', sort_order: 1 }),
      ],
    });

    expect(path).toBe('first.png');
  });

  it('skips videos and picks the first image behind them', () => {
    const path = getCatalogPreviewPath({
      thumbnail_path: null,
      media: [
        media({ id: 'a', media_type: 'video', storage_path: 'clip.mp4', sort_order: 1 }),
        media({ id: 'b', storage_path: 'photo.png', sort_order: 2 }),
      ],
    });

    expect(path).toBe('photo.png');
  });

  it('returns null when there is neither a thumbnail nor image media', () => {
    expect(
      getCatalogPreviewPath({
        thumbnail_path: null,
        media: [media({ id: 'a', media_type: 'video', storage_path: 'clip.mp4' })],
      }),
    ).toBeNull();

    expect(getCatalogPreviewPath({ thumbnail_path: null })).toBeNull();
  });
});

describe('isSvgPath', () => {
  it('matches svg paths regardless of case', () => {
    expect(isSvgPath('user/media/logo.svg')).toBe(true);
    expect(isSvgPath('user/media/logo.SVG')).toBe(true);
  });

  it('does not match other image extensions', () => {
    expect(isSvgPath('user/media/photo.png')).toBe(false);
    expect(isSvgPath('user/media/svg-mockup.png')).toBe(false);
  });
});
