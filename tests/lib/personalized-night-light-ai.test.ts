import { describe, expect, it } from 'vitest';
import { buildPersonalizedNightLightOpenAiPayload } from '@/lib/personalized-night-light-ai';

const baseRequest = {
  modelId: '00000000-0000-0000-0000-000000000000',
  modelSlug: 'portrait-personalized-night-light',
  modelTitle: 'Portrait night light',
  boilerplateImagePath: null,
  userImagePaths: ['user/photo.jpg'],
  customText: 'Hello',
  customTextFormatting: undefined,
  ledColor: 'warm_white',
  multiColor: false,
  comfortableColors: [{ value: 'warm_white', label: 'Warm white', hex: '#FFDDAA' }],
};

const boilerplates = [
  { image_path: 'catalog/rectangular.jpg', manufacturing_process: 'rectangular UV-printed acrylic' },
  { image_path: 'catalog/round.jpg', manufacturing_process: 'round UV-printed acrylic' },
];

describe('buildPersonalizedNightLightOpenAiPayload', () => {
  it('includes one image entry per selected boilerplate', () => {
    const payload = buildPersonalizedNightLightOpenAiPayload(baseRequest, boilerplates);
    expect(payload.images).toEqual(['user/photo.jpg', 'catalog/rectangular.jpg', 'catalog/round.jpg']);
  });

  it('sizes expectedOptions and optionProcesses to the selection, not a fixed constant', () => {
    const payload = buildPersonalizedNightLightOpenAiPayload(baseRequest, boilerplates);
    expect(payload.expectedOptions).toBe(2);
    expect(payload.outputContract.optionProcesses).toEqual([
      { optionIndex: 1, process: 'rectangular UV-printed acrylic', publicPath: 'catalog/rectangular.jpg' },
      { optionIndex: 2, process: 'round UV-printed acrylic', publicPath: 'catalog/round.jpg' },
    ]);
  });

  it('works with a single selected boilerplate', () => {
    const payload = buildPersonalizedNightLightOpenAiPayload(baseRequest, [boilerplates[0]]);
    expect(payload.expectedOptions).toBe(1);
    expect(payload.outputContract.previews).toBe('1 generated preview image paths or files');
  });
});
