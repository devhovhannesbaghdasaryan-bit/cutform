'use server';

import { redirect } from 'next/navigation';
import { createGeneratedItem, createPersonalizedPreviewOptions } from '@/lib/generated-items';
import { PERSONALIZED_NIGHT_LIGHT } from '@/lib/marketplace-constants';
import { generateOpenAiImage } from '@/lib/openai-image';
import { buildPersonalizedNightLightOpenAiPayload } from '@/lib/personalized-night-light-ai';
import { preflightSvg } from '@/lib/sanitize';
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';
import { debitCredits, refundCredits } from '@/lib/credits';

const imageExtByMime: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

function getImageFiles(formData: FormData) {
  return formData
    .getAll('images')
    .filter((value): value is File => value instanceof File && value.size > 0);
}

async function uploadUserImage(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  userId: string,
  file: File,
) {
  const ext = imageExtByMime[file.type];
  if (!ext) throw new Error('Upload PNG, JPG, or WEBP images only.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Images must be 20 MB or smaller.');
  const path = `${userId}/personalized-night-lights/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('user-uploads')
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

async function uploadGeneratedSvg(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  userId: string,
  folder: string,
  svg: string,
) {
  const { cleanSvg, warnings } = preflightSvg(svg);
  const path = `${userId}/personalized-night-lights/${folder}/${crypto.randomUUID()}.svg`;
  const { error } = await supabase.storage
    .from('generated-assets')
    .upload(path, new TextEncoder().encode(cleanSvg), { contentType: 'image/svg+xml', upsert: false });
  if (error) throw new Error(error.message);
  return { path, warnings };
}

async function uploadGeneratedPng(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  userId: string,
  folder: string,
  bytes: Uint8Array,
) {
  const path = `${userId}/personalized-night-lights/${folder}/${crypto.randomUUID()}.png`;
  const { error } = await supabase.storage
    .from('generated-assets')
    .upload(path, bytes, { contentType: 'image/png', upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

function createPreviewSvg(index: number, text: string, color: string | null, multiColor: boolean) {
  const glow = multiColor ? '#a78bfa' : color === 'sky_blue' ? '#7dd3fc' : color === 'mint' ? '#86efac' : '#fbbf24';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 650"><rect width="900" height="650" fill="#111827"/><path id="cut-acrylic-panel" d="M230 80h440a70 70 0 0 1 70 70v300H160V150a70 70 0 0 1 70-70z" fill="none" stroke="${glow}" stroke-width="8"/><path id="engrave-portrait" d="M315 220c45-80 225-80 270 0 20 40 5 110-50 145-55 35-115 35-170 0-55-35-70-105-50-145z" fill="none" stroke="#e0f2fe" stroke-width="6"/><rect id="cut-wood-base" x="240" y="470" width="420" height="90" rx="16" fill="#9a5a22"/><text id="engrave-base-text" x="450" y="525" text-anchor="middle" font-family="Arial" font-size="34" fill="#fff7ed">${text.replace(/[<>&]/g, '').slice(0, 100) || `Option ${index}`}</text></svg>`;
}

export async function generatePersonalizedNightLightAction(formData: FormData) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const modelId = String(formData.get('modelId') ?? '');
  if (!user) redirect(`/login?next=/personalize/${encodeURIComponent(modelId)}`);

  const files = getImageFiles(formData);
  if (!files.length || files.length > PERSONALIZED_NIGHT_LIGHT.maxImages) {
    throw new Error(`Upload 1 to ${PERSONALIZED_NIGHT_LIGHT.maxImages} images.`);
  }
  if (formData.get('uploadRightsConfirmed') !== 'on') {
    throw new Error('Confirm that you have rights to use the uploaded images.');
  }

  const customText = String(formData.get('customText') ?? '').slice(0, PERSONALIZED_NIGHT_LIGHT.maxTextLength);
  const multiColor = formData.get('multiColor') === 'on';
  const ledColor = multiColor ? null : String(formData.get('ledColor') ?? 'warm_white');

  const { data: model, error: modelError } = await supabase
    .from('personalization_models')
    .select('id, slug, title, boilerplate_image_path, status, form_schema')
    .eq('id', modelId)
    .eq('status', 'published')
    .maybeSingle<{
      id: string;
      slug: string;
      title: string;
      boilerplate_image_path: string | null;
      status: string;
      form_schema: Record<string, unknown>;
    }>();

  if (modelError || !model) throw new Error(modelError?.message ?? 'Personalization model is not available.');

  const creditCost = Number(model.form_schema.creditCost ?? 0);
  let debited = false;
  let generatedId: string | null = null;
  const creditSupabase = creditCost > 0 ? getServiceSupabase() : null;
  if (creditCost > 0) {
    await debitCredits(creditSupabase!, {
      userId: user.id,
      amount: creditCost,
      referenceType: 'personalized_night_light',
      metadata: {
        modelId: model.id,
        modelSlug: model.slug,
      },
    });
    debited = true;
  }

  try {
    const originalImagePaths = [];
    for (const file of files) originalImagePaths.push(await uploadUserImage(supabase, user.id, file));

    const requestPayload = buildPersonalizedNightLightOpenAiPayload({
      modelId: model.id,
      modelSlug: model.slug,
      modelTitle: model.title,
      boilerplateImagePath: model.boilerplate_image_path,
      userImagePaths: originalImagePaths,
      customText,
      ledColor,
      multiColor,
      comfortableColors: PERSONALIZED_NIGHT_LIGHT.comfortableLedColors.map((color) => ({ ...color })),
    });

    const generated = await createGeneratedItem(supabase, {
      userId: user.id,
      generatedBy: user.id,
      productType: 'personalized_night_light',
      title: `${model.title} preview`,
      prompt: requestPayload.prompt,
      customText,
      originalImagePaths,
      color: ledColor,
      multiColor,
      generationOptions: {
        modelId: model.id,
        modelSlug: model.slug,
        boilerplateImagePath: model.boilerplate_image_path,
        openAiRequest: requestPayload,
        uploadRightsConfirmed: true,
        previewDisclaimerAccepted: true,
        salePriceCents: Number(model.form_schema.basePriceCents ?? 0),
      },
      creditCost,
      reviewStatus: 'preview_ready',
    });
    generatedId = generated.id;

    const options = [];
    const allWarnings: string[] = [];
    for (let index = 1; index <= 3; index += 1) {
      const svg = createPreviewSvg(index, customText, ledColor, multiColor);
      const image = await generateOpenAiImage({
        prompt: `${requestPayload.prompt}\n\nCreate preview option ${index} of 3. Keep the same product form but vary composition subtly.`,
        images: files,
        size: '1024x1024',
        purpose: 'edit',
      });
      const previewPath = await uploadGeneratedPng(supabase, user.id, 'previews', image.bytes);
      const hidden = await uploadGeneratedSvg(supabase, user.id, 'hidden-svg', svg);
      allWarnings.push(...hidden.warnings);
      options.push({
        generatedItemId: generated.id,
        optionIndex: index,
        previewImagePath: previewPath,
        hiddenSvgPath: hidden.path,
        metadata: {
          modelId: model.id,
          optionIndex: index,
          revisedPrompt: image.revisedPrompt,
          validationWarnings: hidden.warnings,
        },
      });
    }
    await createPersonalizedPreviewOptions(supabase, options);
    if (allWarnings.length) {
      await supabase
        .from('generated_items')
        .update({ manufacturing_metadata: { validationWarnings: allWarnings } })
        .eq('id', generated.id);
    }
  } catch (error) {
    if (debited) {
      await refundCredits(creditSupabase!, {
        userId: user.id,
        amount: creditCost,
        referenceType: 'personalized_night_light',
        referenceId: generatedId,
        metadata: {
          modelId: model.id,
          reason: error instanceof Error ? error.message : 'personalized_generation_failed',
        },
      });
    }
    throw error;
  }

  if (!generatedId) throw new Error('Personalized generation did not create an item.');
  redirect(`/generated/${generatedId}`);
}
