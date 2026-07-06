import 'server-only';

import type OpenAI from 'openai';

/** Uploads an image to OpenAI File Storage for reuse across generation requests. Throws on failure. */
export async function uploadReferenceImage(
  client: Pick<OpenAI, 'files'>,
  file: File,
): Promise<string> {
  const uploaded = await client.files.create({ file, purpose: 'vision' });
  return uploaded.id;
}

/** Best-effort delete of a previously uploaded reference file. Never throws. */
export async function deleteReferenceFile(
  client: Pick<OpenAI, 'files'>,
  fileId: string,
): Promise<void> {
  try {
    await client.files.delete(fileId);
  } catch (error) {
    console.error('[personalization-boilerplates] failed to delete OpenAI file', fileId, error);
  }
}
