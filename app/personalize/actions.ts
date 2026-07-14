'use server';

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  generationFormSchema,
  getImageFiles,
  summarizeTextFormatting,
} from '@/app/personalize/form-parsing';
import { debitCredits, getCreditBalance, refundCredits } from '@/lib/credits';
import { createGeneratedItem, createPersonalizedPreviewOptions } from '@/lib/generated-items';
import { mapCatalogItemTypeToProductType } from '@/lib/marketplace-constants';
import { getOpenAiClient } from '@/lib/openai-client';
import { generateOpenAiImage } from '@/lib/openai-image';
import { composePersonalizationPrompt, friendlyGenerationError } from '@/lib/personalization-ai';
import {
  COMFORTABLE_COLORS,
  DEFAULT_SOLID_ENGRAVING_PROMPT,
  type LaserEngravingStyle,
} from '@/lib/personalization-constants';
import type { PersonalizationBoilerplate } from '@/lib/personalization-boilerplates';
import { listCatalogItemBoilerplates } from '@/lib/personalization-boilerplates';
import { IMAGE_EXTENSION_BY_MIME, uploadToBucket } from '@/lib/storage';
import { getCurrentUser, getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';

// Sanctioned exception to the ActionState convention (lib/action-state.ts):
// the credits dialog in components/personalize-item-form.tsx needs the
// richer `insufficient_credits` code plus required/available credit counts.
export type PersonalizedGenerationState = {
  code: 'idle' | 'error' | 'insufficient_credits';
  message: string | null;
  requiredCredits?: number;
  availableCredits?: number;
};

function errorState(message: string): PersonalizedGenerationState {
  return { code: 'error', message };
}

interface ActiveEngravingStyle {
  /** null means the item has no engraving styles configured (legacy single preview). */
  key: LaserEngravingStyle | null;
  /** English label stored on the option; the UI localizes from `key` when present. */
  label: string | null;
  /** Extra style instruction appended to the generation prompt. */
  extraPrompt: string | null;
  priceCents: number;
  currency: string;
}

/**
 * Resolves which engraving styles to generate for an item. Contour uses the
 * item's base price; Solid uses its own price and prompt. When neither flag is
 * set, returns a single style at the base price so behaviour is unchanged.
 */
function buildActiveEngravingStyles(item: {
  price_cents: number;
  currency: string;
  laser_contour_enabled: boolean;
  laser_solid_enabled: boolean;
  laser_solid_price_cents: number | null;
  laser_solid_prompt: string | null;
}): ActiveEngravingStyle[] {
  const styles: ActiveEngravingStyle[] = [];
  if (item.laser_contour_enabled) {
    styles.push({
      key: 'contour',
      label: 'Hairline contour',
      extraPrompt: null,
      priceCents: item.price_cents,
      currency: item.currency,
    });
  }
  if (item.laser_solid_enabled) {
    styles.push({
      key: 'solid',
      label: 'Solid scratching',
      extraPrompt: item.laser_solid_prompt ?? DEFAULT_SOLID_ENGRAVING_PROMPT,
      priceCents: item.laser_solid_price_cents ?? item.price_cents,
      currency: item.currency,
    });
  }
  if (!styles.length) {
    styles.push({
      key: null,
      label: null,
      extraPrompt: null,
      priceCents: item.price_cents,
      currency: item.currency,
    });
  }
  return styles;
}

async function uploadUserImage(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  userId: string,
  file: File,
) {
  const ext = IMAGE_EXTENSION_BY_MIME[file.type];
  if (!ext) throw new Error('Upload PNG, JPG, or WEBP images only.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Images must be 20 MB or smaller.');
  return uploadToBucket(supabase, {
    bucket: 'user-uploads',
    path: `${userId}/personalized-items/${crypto.randomUUID()}.${ext}`,
    body: await file.arrayBuffer(),
    contentType: file.type,
  });
}

async function uploadGeneratedPng(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  userId: string,
  bytes: Uint8Array,
) {
  return uploadToBucket(supabase, {
    bucket: 'generated-assets',
    path: `${userId}/personalized-items/previews/${crypto.randomUUID()}.png`,
    body: bytes,
    contentType: 'image/png',
  });
}

export async function generatePersonalizedItemAction(
  _previousState: PersonalizedGenerationState,
  formData: FormData,
): Promise<PersonalizedGenerationState> {
  const supabase = await getServerSupabase();
  const user = await getCurrentUser();
  const rawItemId = String(formData.get('catalogItemId') ?? '');
  if (!user) redirect(`/login?next=/personalize/${encodeURIComponent(rawItemId)}`);
  const t = await getTranslations('personalize');

  const parsed = generationFormSchema.safeParse({
    catalogItemId: rawItemId,
    customText: String(formData.get('customText') ?? ''),
    color: formData.get('color'),
    images: getImageFiles(formData),
    boilerplateIds: formData.getAll('boilerplateIds'),
  });
  if (!parsed.success) {
    const invalidFields = new Set(parsed.error.issues.map((issue) => issue.path[0]));
    if (invalidFields.has('images')) return errorState(t('errorUpload'));
    if (invalidFields.has('customText')) return errorState(t('errorText'));
    return errorState(t('errorItem'));
  }
  const { catalogItemId, customText, color, images: rawFiles } = parsed.data;
  const customTextFormatting = summarizeTextFormatting(formData.get('customTextHtml'));

  const { data: item, error: itemError } = await supabase
    .from('catalog_items')
    .select(
      'id, slug, title, price_cents, currency, item_type, status, is_customizable, system_prompt, skill_id, tags, laser_contour_enabled, laser_solid_enabled, laser_solid_price_cents, laser_solid_prompt',
    )
    .eq('id', catalogItemId)
    .eq('status', 'published')
    .maybeSingle();
  if (itemError || !item || !item.is_customizable) return errorState(t('errorItem'));

  const configuredBoilerplates = await listCatalogItemBoilerplates(supabase, item.id);
  // The Solid engraving style carries its own prompt, so it counts as a usable
  // generation source even without a system prompt or boilerplate.
  if (!item.system_prompt && !configuredBoilerplates.length && !item.laser_solid_enabled) {
    return errorState(t('comingSoonBody'));
  }

  const requestedBoilerplateIds = parsed.data.boilerplateIds;
  let selectedBoilerplates: PersonalizationBoilerplate[] = [];
  if (configuredBoilerplates.length) {
    if (!requestedBoilerplateIds.length) return errorState(t('selectAtLeastOne'));
    selectedBoilerplates = configuredBoilerplates.filter((boilerplate) =>
      requestedBoilerplateIds.includes(boilerplate.id),
    );
    if (selectedBoilerplates.length !== requestedBoilerplateIds.length) {
      return errorState(t('errorStyle'));
    }
  }

  const tags = new Set(item.tags ?? []);
  const files = tags.has('personal_photo') ? rawFiles : [];
  if (tags.has('personal_photo') && files.length !== 1) return errorState(t('errorUpload'));

  // Laser-on-glass engraving styles. When neither flag is set the item keeps its
  // single-style behaviour; otherwise one preview is generated per enabled style,
  // each priced independently (Contour = base price, Solid = its own price).
  const activeStyles = buildActiveEngravingStyles(item);
  const callTargets: Array<PersonalizationBoilerplate | null> = selectedBoilerplates.length
    ? selectedBoilerplates
    : [null];

  const creditCost = callTargets.length * activeStyles.length;
  let debited = false;
  let generatedId: string | null = null;
  let creditSupabase: ReturnType<typeof getServiceSupabase> | null = null;
  try {
    creditSupabase = getServiceSupabase();
    const availableCredits = await getCreditBalance(creditSupabase, user.id);
    if (availableCredits < creditCost) {
      return {
        code: 'insufficient_credits',
        message: `You need ${creditCost} credits to generate these previews, but you have ${availableCredits}.`,
        requiredCredits: creditCost,
        availableCredits,
      };
    }
    await debitCredits(creditSupabase, {
      userId: user.id,
      amount: creditCost,
      referenceType: 'personalized_item',
      metadata: { catalogItemId: item.id, boilerplateIds: requestedBoilerplateIds },
    });
    debited = true;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('insufficient credit')) {
      return {
        code: 'insufficient_credits',
        message: 'You do not have enough credits to generate these previews.',
        requiredCredits: creditCost,
      };
    }
    return errorState(t('errorBalance'));
  }

  try {
    const originalImagePaths: string[] = [];
    for (const file of files) originalImagePaths.push(await uploadUserImage(supabase, user.id, file));

    const selectedColor = tags.has('personal_color')
      ? (COMFORTABLE_COLORS.find((option) => option.value === color) ?? null)
      : null;
    const hasPhoto = originalImagePaths.length > 0;
    const personalizedText = tags.has('personal_text') && customText ? customText : null;

    const generated = await createGeneratedItem(supabase, {
      userId: user.id,
      generatedBy: user.id,
      productType: mapCatalogItemTypeToProductType(item.item_type),
      catalogItemId: item.id,
      title: `${item.title} preview`,
      customText: personalizedText,
      originalImagePaths,
      color: selectedColor?.value ?? null,
      multiColor: false,
      generationOptions: {
        catalogItemId: item.id,
        boilerplateIds: selectedBoilerplates.map((boilerplate) => boilerplate.id),
        customTextFormatting,
        laserStyles: activeStyles
          .map((style) => style.key)
          .filter((key): key is LaserEngravingStyle => key !== null),
      },
      creditCost,
      reviewStatus: 'preview_ready',
    });
    generatedId = generated.id;

    const openAiClient = getOpenAiClient();
    const options = [];
    let optionIndex = 0;
    for (const reference of callTargets) {
      for (const style of activeStyles) {
        optionIndex += 1;
        const prompt = composePersonalizationPrompt({
          systemPrompt: item.system_prompt,
          boilerplateInstruction: reference?.generation_instruction ?? null,
          engravingInstruction: style.extraPrompt,
          personalizedText,
          personalizedTextFormatting: customTextFormatting || null,
          colorLabel: selectedColor?.label ?? null,
          colorHex: selectedColor?.hex ?? null,
          hasPhoto,
        });
        const image = await generateOpenAiImage(openAiClient, {
          prompt,
          userImages: files,
          referenceFileId: reference?.openai_file_id ?? null,
          size: '1024x1024',
          quality: 'low',
        });
        const previewPath = await uploadGeneratedPng(supabase, user.id, image.bytes);
        options.push({
          generatedItemId: generated.id,
          optionIndex,
          previewImagePath: previewPath,
          manufacturingFilePath: null,
          boilerplateId: reference?.id ?? null,
          metadata: {
            boilerplateId: reference?.id ?? null,
            boilerplateName: reference?.name ?? null,
            manufacturingProcess: reference?.manufacturing_process ?? null,
            requiresManufacturingSvg: reference?.generate_hidden_svg ?? false,
            manufacturingSvgStatus: 'pending_admin_generation',
            revisedPrompt: image.revisedPrompt,
            validationWarnings: [],
            engravingStyle: style.key,
            engravingStyleLabel: style.label,
            unitPriceCents: style.priceCents,
            unitCurrency: style.currency,
          },
        });
      }
    }
    await createPersonalizedPreviewOptions(supabase, options);
  } catch (error) {
    if (debited && creditSupabase) {
      try {
        await refundCredits(creditSupabase, {
          userId: user.id,
          amount: creditCost,
          referenceType: 'personalized_item',
          referenceId: generatedId,
          metadata: {
            catalogItemId: item.id,
            reason: error instanceof Error ? error.message : 'personalized_generation_failed',
          },
        });
      } catch (refundError) {
        console.error('[personalized-item] credit refund failed', refundError);
      }
    }
    return errorState(error instanceof Error ? friendlyGenerationError(error) : t('errorGeneration'));
  }

  if (!generatedId) return errorState('We could not save the generated previews. Please try again.');
  redirect(`/generated/${generatedId}`);
}
