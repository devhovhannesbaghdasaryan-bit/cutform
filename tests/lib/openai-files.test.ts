import { describe, expect, it, vi } from 'vitest';
import { deleteReferenceFile, uploadReferenceImage } from '@/lib/openai-files';

type FilesClient = Parameters<typeof uploadReferenceImage>[0];

function fakeOpenAiClient(
  overrides: {
    create?: (...args: unknown[]) => unknown;
    del?: (...args: unknown[]) => unknown;
  } = {},
) {
  return {
    files: {
      create: overrides.create ?? vi.fn(async () => ({ id: 'file-abc123' })),
      delete: overrides.del ?? vi.fn(async () => ({ id: 'file-abc123', deleted: true })),
    },
  } as unknown as FilesClient;
}

describe('uploadReferenceImage', () => {
  it('returns the uploaded file id', async () => {
    const client = fakeOpenAiClient();
    const file = new File([new Uint8Array([1, 2, 3])], 'boilerplate.jpg', { type: 'image/jpeg' });
    await expect(uploadReferenceImage(client, file)).resolves.toBe('file-abc123');
    expect(client.files.create).toHaveBeenCalledWith({ file, purpose: 'vision' });
  });

  it('throws when the upload fails', async () => {
    const client = fakeOpenAiClient({
      create: vi.fn(async () => {
        throw new Error('network error');
      }),
    });
    const file = new File([new Uint8Array([1])], 'boilerplate.jpg', { type: 'image/jpeg' });
    await expect(uploadReferenceImage(client, file)).rejects.toThrow('network error');
  });
});

describe('deleteReferenceFile', () => {
  it('deletes the file by id', async () => {
    const client = fakeOpenAiClient();
    await deleteReferenceFile(client, 'file-abc123');
    expect(client.files.delete).toHaveBeenCalledWith('file-abc123');
  });

  it('swallows errors and logs instead of throwing', async () => {
    const client = fakeOpenAiClient({
      del: vi.fn(async () => {
        throw new Error('not found');
      }),
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(deleteReferenceFile(client, 'file-missing')).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
