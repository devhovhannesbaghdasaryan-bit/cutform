'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin';
import { TOY_DECORATION_SIZE_PRESETS } from '@/lib/marketplace-constants';
import { uploadToBucket } from '@/lib/storage';
import { slugify } from '@/lib/utils';
import {
  type AdminSupabase,
  ensureCatalogSlugIsAvailable,
  getOptionalFile,
  syncCatalogItemMedia,
  uploadAdminCatalogAsset,
} from './item-form-parsing';

const toyDecorationGenerationSchema = z.object({
  targetCategory: z.enum(['toys', 'decorations']),
  prompt: z.string().trim().max(1000).optional(),
});

function titleFromPrompt(prompt: string | undefined, fallback: string) {
  if (!prompt) return fallback;
  return prompt
    .split(/[.!?]/)[0]
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    || fallback;
}

function buildToyDecorationDraftMetadata(input: {
  categorySlug: 'toys' | 'decorations';
  prompt?: string;
  imagePath: string;
  referenceFileName?: string;
}) {
  const categoryLabel = input.categorySlug === 'toys' ? 'Toy' : 'Decoration';
  const title = titleFromPrompt(input.prompt, `${categoryLabel} draft from image`);
  const finish = input.categorySlug === 'toys' ? 'smooth child-safe finish pending review' : 'decorative finish pending review';
  const sizes = TOY_DECORATION_SIZE_PRESETS.map((preset) => ({
    key: preset.key,
    label: preset.label,
    maxWidthMm: preset.maxWidthMm,
    maxHeightMm: preset.maxHeightMm,
    status: 'review_required',
  }));
  const description = input.prompt
    ? `Draft ${categoryLabel.toLowerCase()} candidate generated from admin prompt: ${input.prompt}`
    : `Draft ${categoryLabel.toLowerCase()} candidate generated from uploaded image metadata.`;
  const characteristics = [
    `Materials: unknown, review required. Suggested starting assumption is plywood, acrylic, or approved craft material based on final product intent.`,
    `Specifications: generated draft from ${input.imagePath}. Verify scale, part count, edge treatment, and hardware before publishing.`,
    `Dimensions: size presets are proposed only; exact width, height, depth, and tolerances are unknown until admin review.`,
    `Finish: ${finish}.`,
    `Construction details: review joints, small detachable parts, hanging holes, bases, slots, and assembly sequence.`,
    `Production assumptions: laser-cut or CNC-compatible flat parts may be possible, but tooling must be confirmed from final artwork.`,
    `Unknowns: material thickness, compliance constraints, finishing chemistry, package contents, and manufacturing time.`,
    `Reference file: ${input.referenceFileName ?? 'generated placeholder artwork'}.`,
  ].join('\n');

  return { title, description, sizes, characteristics };
}

async function uploadGeneratedCatalogSvg(
  supabase: AdminSupabase,
  userId: string,
  title: string,
  categorySlug: 'toys' | 'decorations',
) {
  const safeTitle = title.replace(/[<>&]/g, '').slice(0, 90);
  const accent = categorySlug === 'toys' ? '#2563eb' : '#be123c';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="#f8fafc"/><rect x="120" y="120" width="960" height="660" rx="36" fill="${accent}"/><circle cx="420" cy="410" r="120" fill="#ffffff" opacity="0.9"/><rect x="560" y="300" width="260" height="220" rx="28" fill="#ffffff" opacity="0.9"/><text x="600" y="690" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#ffffff">${safeTitle}</text></svg>`;
  return uploadToBucket(supabase, {
    bucket: 'catalog-assets',
    path: `${userId}/generated-catalog/${crypto.randomUUID()}.svg`,
    body: new TextEncoder().encode(svg),
    contentType: 'image/svg+xml',
  });
}

export async function generateToyDecorationDraftAction(formData: FormData) {
  const parsed = toyDecorationGenerationSchema.safeParse({
    targetCategory: formData.get('targetCategory'),
    prompt: formData.get('prompt') || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid generation request.');

  const referenceFile = getOptionalFile(formData, 'referenceFile');
  if (!parsed.data.prompt && !referenceFile) {
    throw new Error('Enter a prompt or upload a reference image.');
  }

  const { supabase, user } = await requireAdminPermission('catalog_manage');
  const { data: category, error: categoryError } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', parsed.data.targetCategory)
    .maybeSingle<{ id: string }>();
  if (categoryError || !category) throw new Error(categoryError?.message ?? 'Target category was not found.');

  const uploadedReference = await uploadAdminCatalogAsset(
    supabase,
    user.id,
    referenceFile,
    `generated-catalog/${parsed.data.targetCategory}/references`,
  );
  const metadata = buildToyDecorationDraftMetadata({
    categorySlug: parsed.data.targetCategory,
    prompt: parsed.data.prompt,
    imagePath: uploadedReference ?? 'generated placeholder',
    referenceFileName: referenceFile?.name,
  });
  const generatedImagePath = parsed.data.prompt
    ? await uploadGeneratedCatalogSvg(supabase, user.id, metadata.title, parsed.data.targetCategory)
    : uploadedReference;

  if (!generatedImagePath) throw new Error('Unable to create a draft image.');

  let slug = slugify(metadata.title);
  const slugAvailable = await ensureCatalogSlugIsAvailable(supabase, slug);
  if (!slugAvailable) slug = `${slug}-${crypto.randomUUID().slice(0, 8)}`;

  const { data, error } = await supabase
    .from('catalog_items')
    .insert({
      title: metadata.title,
      slug,
      category_id: category.id,
      item_type: parsed.data.targetCategory === 'toys' ? 'toy' : 'decoration',
      description: metadata.description,
      price_cents: 0,
      status: 'draft',
      is_popular: false,
      is_customizable: false,
      thumbnail_path: generatedImagePath,
      manufacturing_notes: [
        'AI-assisted draft. Admin must review before publishing.',
        uploadedReference ? `Reference image: ${uploadedReference}` : null,
        parsed.data.prompt ? `Prompt: ${parsed.data.prompt}` : null,
      ].filter(Boolean).join('\n'),
      sizes: metadata.sizes,
      characteristics: metadata.characteristics,
      created_by: user.id,
    })
    .select('id')
    .single<{ id: string }>();

  if (error || !data) throw new Error(error?.message ?? 'Unable to create generated draft.');
  await syncCatalogItemMedia(supabase, user.id, data.id, new FormData(), generatedImagePath);

  revalidatePath('/admin/items');
  revalidatePath('/admin/create');
  redirect(`/admin/items/${data.id}`);
}
