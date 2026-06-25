'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';
import { PRODUCT_TYPES } from '@/lib/marketplace-constants';
import { preflightSvg } from '@/lib/sanitize';
import { computePriceCents } from '@/lib/pricing';
import { debitCredits, refundCredits } from '@/lib/credits';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = new Set(['image/png', 'image/jpeg', 'image/webp']);
const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const startSchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  rightsConfirmed: z.literal(true, {
    error: 'Confirm that you have rights to use the uploaded image.',
  }),
});

const approveSchema = z.object({
  sessionId: z.string().uuid(),
  title: z.string().trim().min(1).max(80),
  productType: z.enum(PRODUCT_TYPES),
});

export interface StartSessionResult {
  sessionId: string;
  imagePath: string;
}

export async function startSession(input: {
  imageBase64: string;
  mimeType: string;
  rightsConfirmed: boolean;
}): Promise<StartSessionResult> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) throw new Error('Invalid image input.');

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  const { imageBase64, mimeType } = parsed.data;
  const buffer = Buffer.from(imageBase64, 'base64');
  if (buffer.byteLength > MAX_BYTES) throw new Error('Image exceeds 5 MB limit.');
  if (!ACCEPTED.has(mimeType)) throw new Error('Only PNG, JPEG, or WebP are accepted.');

  const { data: session, error: insertErr } = await supabase
    .from('generation_sessions')
    .insert({
      user_id: user.id,
      image_path: 'pending',
      upload_rights_confirmed: parsed.data.rightsConfirmed,
    })
    .select('id')
    .single<{ id: string }>();
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

export async function approveSession(input: {
  sessionId: string;
  title: string;
  productType: z.infer<typeof approveSchema>['productType'];
}): Promise<{ generatedItemId: string }> {
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid approval input.');

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  const { data: session, error: readErr } = await supabase
    .from('generation_sessions')
    .select('id, user_id, image_path, upload_rights_confirmed, input_units, output_units, last_title, last_svg')
    .eq('id', parsed.data.sessionId)
    .single<{
      id: string;
      user_id: string;
      image_path: string;
      upload_rights_confirmed: boolean;
      input_units: number;
      output_units: number;
      last_title: string | null;
      last_svg: string | null;
    }>();
  if (readErr || !session) throw new Error('Session not found.');
  if (session.user_id !== user.id) throw new Error('Forbidden.');
  if (!session.last_svg || !session.last_title) {
    throw new Error('No SVG to approve yet - generate at least one design first.');
  }
  if (!session.upload_rights_confirmed) {
    throw new Error('Confirm image upload rights before saving this generated item.');
  }

  const { cleanSvg, warnings } = preflightSvg(session.last_svg);
  const price = computePriceCents(session.input_units, session.output_units);
  const generationCreditCost = Math.max(
    1,
    Math.ceil(((session.input_units ?? 0) + (session.output_units ?? 0)) / 1000),
  );
  const service = getServiceSupabase();
  let generatedItemId: string | null = null;
  let debited = false;

  try {
    await debitCredits(service, {
      userId: user.id,
      amount: generationCreditCost,
      referenceType: 'generation_session',
      referenceId: session.id,
      metadata: {
        productType: parsed.data.productType,
        inputUnits: session.input_units,
        outputUnits: session.output_units,
      },
    });
    debited = true;

    const { data: generatedItem, error: generatedErr } = await supabase
      .from('generated_items')
      .insert({
        user_id: user.id,
        generated_by: user.id,
        product_type: parsed.data.productType,
        title: parsed.data.title,
        source_image_path: session.image_path,
        svg_content: cleanSvg,
        manufacturing_metadata: {
          validationWarnings: warnings,
          apiUsage: {
            inputUnits: session.input_units,
            outputUnits: session.output_units,
            apiCostCents: price.apiCostCents,
            creditSpend: generationCreditCost,
          },
        },
        generation_options: {
          salePriceCents: price.priceCents,
          markupCents: price.markupCents,
          source: 'generic_create_flow',
          uploadRightsConfirmed: session.upload_rights_confirmed,
          previewDisclaimerAccepted: true,
        },
        credit_cost: generationCreditCost,
        review_status: warnings.length ? 'review_required' : 'preview_ready',
      })
      .select('id')
      .single<{ id: string }>();
    if (generatedErr || !generatedItem) throw new Error(generatedErr?.message ?? 'Approval failed.');
    generatedItemId = generatedItem.id;
  } catch (error) {
    if (debited) {
      await refundCredits(service, {
        userId: user.id,
        amount: generationCreditCost,
        referenceType: 'generation_session',
        referenceId: session.id,
        metadata: {
          productType: parsed.data.productType,
          reason: error instanceof Error ? error.message : 'approval_failed',
        },
      });
    }
    throw error;
  }

  await supabase.from('generation_sessions').delete().eq('id', session.id);

  try {
    await service.storage.from('uploads').remove([session.image_path]);
  } catch {
    // Non-fatal. A storage janitor can sweep orphaned upload objects.
  }

  redirect(`/generated/${generatedItemId}`);
}

export async function abandonSession(sessionId: string): Promise<void> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: session } = await supabase
    .from('generation_sessions')
    .select('id, image_path')
    .eq('id', sessionId)
    .single<{ id: string; image_path: string }>();
  if (!session) return;

  await supabase.from('generation_sessions').delete().eq('id', session.id);
  try {
    const service = getServiceSupabase();
    await service.storage.from('uploads').remove([session.image_path]);
  } catch {
    // ignore
  }
}
