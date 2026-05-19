'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';
import { sanitizeSvg } from '@/lib/sanitize';
import { computePriceCents } from '@/lib/pricing';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED = new Set(['image/png', 'image/jpeg', 'image/webp']);
const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const startSchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
});

export interface StartSessionResult {
  sessionId: string;
  imagePath: string;
}

export async function startSession(input: { imageBase64: string; mimeType: string }): Promise<StartSessionResult> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) throw new Error('Invalid image input.');

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  const { imageBase64, mimeType } = parsed.data;
  const buffer = Buffer.from(imageBase64, 'base64');
  if (buffer.byteLength > MAX_BYTES) throw new Error('Image exceeds 5 MB limit.');
  if (!ACCEPTED.has(mimeType)) throw new Error('Only PNG, JPEG, or WebP are accepted.');

  // Create session row first to get the id used in the storage path.
  const { data: session, error: insertErr } = await supabase
    .from('generation_sessions')
    .insert({ user_id: user.id, image_path: 'pending' })
    .select('id')
    .single();
  if (insertErr || !session) throw new Error(insertErr?.message ?? 'Failed to start session.');

  const imagePath = `${user.id}/${session.id}.${EXT_BY_MIME[mimeType]}`;
  const { error: uploadErr } = await supabase.storage
    .from('uploads')
    .upload(imagePath, buffer, { contentType: mimeType, upsert: false });
  if (uploadErr) {
    await supabase.from('generation_sessions').delete().eq('id', session.id);
    throw new Error(`Upload failed: ${uploadErr.message}`);
  }

  await supabase
    .from('generation_sessions')
    .update({ image_path: imagePath })
    .eq('id', session.id);

  return { sessionId: session.id, imagePath };
}

export async function approveSession(sessionId: string): Promise<{ productId: string }> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  const { data: session, error: readErr } = await supabase
    .from('generation_sessions')
    .select('id, user_id, image_path, input_tokens, output_tokens, last_title, last_svg')
    .eq('id', sessionId)
    .single();
  if (readErr || !session) throw new Error('Session not found.');
  if (session.user_id !== user.id) throw new Error('Forbidden.');
  if (!session.last_svg || !session.last_title) {
    throw new Error('No SVG to approve yet — generate at least one design first.');
  }

  const cleanSvg = sanitizeSvg(session.last_svg);
  const price = computePriceCents(session.input_tokens, session.output_tokens);

  const { data: product, error: productErr } = await supabase
    .from('products')
    .insert({
      user_id: user.id,
      title: session.last_title,
      svg_content: cleanSvg,
      input_tokens: session.input_tokens,
      output_tokens: session.output_tokens,
      token_cost_cents: price.tokenCostCents,
      markup_cents: price.markupCents,
      price_cents: price.priceCents,
    })
    .select('id')
    .single();
  if (productErr || !product) throw new Error(productErr?.message ?? 'Approval failed.');

  // Cleanup: delete session row (cascades not needed) and storage object.
  await supabase.from('generation_sessions').delete().eq('id', session.id);

  try {
    const service = getServiceSupabase();
    await service.storage.from('uploads').remove([session.image_path]);
  } catch {
    // Service role not configured or remove failed — non-fatal, janitor can sweep.
  }

  redirect(`/products/${product.id}`);
}

export async function abandonSession(sessionId: string): Promise<void> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: session } = await supabase
    .from('generation_sessions')
    .select('id, image_path')
    .eq('id', sessionId)
    .single();
  if (!session) return;

  await supabase.from('generation_sessions').delete().eq('id', session.id);
  try {
    const service = getServiceSupabase();
    await service.storage.from('uploads').remove([session.image_path]);
  } catch {
    // ignore
  }
}
