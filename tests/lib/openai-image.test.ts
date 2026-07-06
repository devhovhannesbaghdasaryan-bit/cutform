import { describe, expect, it, vi } from 'vitest';
import { extractGeneratedImage, generateOpenAiImage } from '@/lib/openai-image';

describe('extractGeneratedImage', () => {
  it('decodes the base64 result from the image_generation_call output item', () => {
    const base64 = Buffer.from('fake-png-bytes').toString('base64');
    const result = extractGeneratedImage({
      output: [{ type: 'reasoning' }, { type: 'image_generation_call', result: base64 }],
    });
    expect(result.bytes).toEqual(new Uint8Array(Buffer.from('fake-png-bytes')));
    expect(result.revisedPrompt).toBeNull();
  });

  it('throws when no image_generation_call is present', () => {
    expect(() => extractGeneratedImage({ output: [{ type: 'reasoning' }] })).toThrow(
      'OpenAI did not return a generated image.',
    );
  });

  it('throws when the image_generation_call has no result', () => {
    expect(() =>
      extractGeneratedImage({ output: [{ type: 'image_generation_call', result: null }] }),
    ).toThrow('OpenAI did not return a generated image.');
  });
});

describe('generateOpenAiImage', () => {
  it('sends the prompt, user images, and reference file id to the Responses API', async () => {
    const base64 = Buffer.from('generated-bytes').toString('base64');
    const create = vi.fn(async () => ({
      output: [{ type: 'image_generation_call', result: base64 }],
    }));
    const client = { responses: { create } } as unknown as Parameters<
      typeof generateOpenAiImage
    >[0];
    const userImage = new File([new Uint8Array([9, 9])], 'user.jpg', { type: 'image/jpeg' });

    const result = await generateOpenAiImage(client, {
      prompt: 'Generate a night light',
      userImages: [userImage],
      referenceFileId: 'file-boilerplate-1',
      size: '1024x1024',
      quality: 'low',
    });

    expect(result.bytes).toEqual(new Uint8Array(Buffer.from('generated-bytes')));
    expect(create).toHaveBeenCalledTimes(1);
    // biome-ignore lint/suspicious/noExplicitAny: test double for the Responses API request body
    const requestBody = (create.mock.calls[0] as any[])[0];
    expect(requestBody.model).toBe('gpt-5-mini');
    expect(requestBody.store).toBe(false);
    expect(requestBody.tools).toEqual([
      { type: 'image_generation', model: 'gpt-image-2', size: '1024x1024', quality: 'low' },
    ]);
    const [message] = requestBody.input;
    expect(message.role).toBe('user');
    expect(message.content[0]).toEqual({ type: 'input_text', text: 'Generate a night light' });
    expect(message.content[1]).toMatchObject({ type: 'input_image', detail: 'auto' });
    expect(message.content[1].image_url).toMatch(/^data:image\/jpeg;base64,/);
    expect(message.content[2]).toEqual({
      type: 'input_image',
      detail: 'auto',
      file_id: 'file-boilerplate-1',
    });
  });
});
