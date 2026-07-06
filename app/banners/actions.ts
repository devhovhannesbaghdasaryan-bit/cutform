'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { debitBannerCredits, refundBannerCredits } from '@/lib/banner-credits';
import { createGeneratedItem } from '@/lib/generated-items';
import { BANNER_CREDIT_COSTS } from '@/lib/marketplace-constants';
import { IMAGE_EXTENSION_BY_MIME, uploadToBucket } from '@/lib/storage';
import { getCurrentUser, getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';

const bannerGenerationSchema = z.object({
  prompt: z.string().trim().min(5, 'Prompt is required.').max(2000),
  sizeKey: z.string().trim().min(1, 'Choose a banner size.'),
  uploadRightsConfirmed: z.literal('on', {
    error: 'Confirm that you have rights to use the reference image.',
  }),
});

const bannerCustomizationSchema = z.object({
  sampleId: z.string().uuid('Choose a banner sample.'),
  sizeKey: z.string().trim().min(1, 'Choose a banner size.'),
  bannerText: z.string().trim().min(1, 'Banner text is required.').max(120),
});

function getFile(formData: FormData, name: string) {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

async function uploadReferenceImage(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  userId: string,
  file: File | null,
) {
  if (!file) return null;
  const ext = IMAGE_EXTENSION_BY_MIME[file.type];
  if (!ext) throw new Error('Upload PNG, JPG, or WEBP reference images only.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Reference image must be 20 MB or smaller.');
  return uploadToBucket(supabase, {
    bucket: 'user-uploads',
    path: `${userId}/banners/${crypto.randomUUID()}.${ext}`,
    body: await file.arrayBuffer(),
    contentType: file.type,
  });
}

async function uploadGeneratedBannerPreview(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  userId: string,
  prompt: string,
) {
  const safePrompt = prompt.replace(/[<>&]/g, '').slice(0, 120);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 500"><rect width="1200" height="500" fill="#f8fafc"/><rect x="50" y="50" width="1100" height="400" rx="28" fill="#0f766e"/><text x="600" y="270" text-anchor="middle" font-family="Arial, sans-serif" font-size="58" font-weight="700" fill="#ffffff">${safePrompt}</text></svg>`;
  return uploadToBucket(supabase, {
    bucket: 'generated-assets',
    path: `${userId}/banners/generated/${crypto.randomUUID()}.svg`,
    body: new TextEncoder().encode(svg),
    contentType: 'image/svg+xml',
  });
}

async function uploadCustomizedBannerPreview(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  userId: string,
  text: string,
  sampleTitle: string,
) {
  const safeText = text.replace(/[<>&]/g, '').slice(0, 120);
  const safeSample = sampleTitle.replace(/[<>&]/g, '').slice(0, 80);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 500"><rect width="1200" height="500" fill="#f8fafc"/><rect x="50" y="50" width="1100" height="400" rx="24" fill="#1d4ed8"/><text x="600" y="245" text-anchor="middle" font-family="Arial, sans-serif" font-size="64" font-weight="700" fill="#ffffff">${safeText}</text><text x="600" y="315" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#dbeafe">${safeSample}</text></svg>`;
  return uploadToBucket(supabase, {
    bucket: 'generated-assets',
    path: `${userId}/banners/customized/${crypto.randomUUID()}.svg`,
    body: new TextEncoder().encode(svg),
    contentType: 'image/svg+xml',
  });
}

export async function customizeBannerSampleAction(formData: FormData) {
  const parsed = bannerCustomizationSchema.safeParse({
    sampleId: formData.get('sampleId'),
    sizeKey: formData.get('sizeKey'),
    bannerText: formData.get('bannerText'),
  });
  if (!parsed.success)
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid banner customization.');

  const supabase = await getServerSupabase();
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/banners');

  const [{ data: sample, error: sampleError }, { data: preset, error: presetError }] =
    await Promise.all([
      supabase
        .from('banner_samples')
        .select('id, title, image_path, prompt, reference_paths')
        .eq('id', parsed.data.sampleId)
        .eq('status', 'published')
        .maybeSingle<{
          id: string;
          title: string;
          image_path: string;
          prompt: string | null;
          reference_paths: string[];
        }>(),
      supabase
        .from('banner_size_presets')
        .select('key, name, width_mm, height_mm, material, finish')
        .eq('key', parsed.data.sizeKey)
        .eq('is_active', true)
        .maybeSingle<{
          key: string;
          name: string;
          width_mm: number;
          height_mm: number;
          material: string;
          finish: string;
        }>(),
    ]);
  if (sampleError || !sample)
    throw new Error(sampleError?.message ?? 'Banner sample is not available.');
  if (presetError || !preset)
    throw new Error(presetError?.message ?? 'Banner size is not available.');

  const previewPath = await uploadCustomizedBannerPreview(
    supabase,
    user.id,
    parsed.data.bannerText,
    sample.title,
  );
  const generated = await createGeneratedItem(supabase, {
    userId: user.id,
    generatedBy: user.id,
    productType: 'banner',
    title: `${sample.title}: ${parsed.data.bannerText}`.slice(0, 80),
    sourceImagePath: sample.image_path,
    prompt: sample.prompt,
    customText: parsed.data.bannerText,
    previewPath,
    selectedPreviewPath: previewPath,
    originalImagePaths: sample.reference_paths ?? [],
    generationOptions: {
      bannerSizeKey: preset.key,
      sizePreset: preset,
      sampleId: sample.id,
      sampleImagePath: sample.image_path,
      textPlacement: {
        zone: 'center',
        alignment: 'center',
        maxCharacters: 120,
      },
      source: 'admin_sample_customization',
    },
    creditCost: BANNER_CREDIT_COSTS.customizeSample,
    reviewStatus: 'review_required',
  });

  redirect(`/generated/${generated.id}`);
}

export async function generateBannerAction(formData: FormData) {
  const parsed = bannerGenerationSchema.safeParse({
    prompt: formData.get('prompt'),
    sizeKey: formData.get('sizeKey'),
    uploadRightsConfirmed: formData.get('uploadRightsConfirmed'),
  });
  if (!parsed.success)
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid banner request.');

  const supabase = await getServerSupabase();
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/banners');

  const cost = BANNER_CREDIT_COSTS.advancedGeneration;
  let debited = false;
  let generatedId: string | null = null;
  const creditSupabase = cost > 0 ? getServiceSupabase() : null;
  try {
    if (cost > 0) {
      await debitBannerCredits(creditSupabase!, {
        userId: user.id,
        amount: cost,
        metadata: { prompt: parsed.data.prompt, sizeKey: parsed.data.sizeKey },
      });
      debited = true;
    }
    const referencePath = await uploadReferenceImage(
      supabase,
      user.id,
      getFile(formData, 'referenceFile'),
    );
    const previewPath = await uploadGeneratedBannerPreview(supabase, user.id, parsed.data.prompt);
    const generated = await createGeneratedItem(supabase, {
      userId: user.id,
      generatedBy: user.id,
      productType: 'banner',
      title: parsed.data.prompt.slice(0, 80),
      prompt: parsed.data.prompt,
      sourceImagePath: referencePath,
      previewPath,
      originalImagePaths: referencePath ? [referencePath] : [],
      generationOptions: {
        bannerSizeKey: parsed.data.sizeKey,
        uploadRightsConfirmed: true,
        previewDisclaimerAccepted: true,
      },
      creditCost: cost,
      reviewStatus: 'review_required',
    });
    generatedId = generated.id;
  } catch (error) {
    if (debited) {
      await refundBannerCredits(creditSupabase!, {
        userId: user.id,
        amount: cost,
        metadata: { reason: error instanceof Error ? error.message : 'banner_generation_failed' },
      });
    }
    throw error;
  }

  redirect(`/generated/${generatedId}`);
}
