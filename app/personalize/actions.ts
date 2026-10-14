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
import {
  composeManufacturingPrompt,
  composePersonalizationPrompt,
  friendlyGenerationError,
} from '@/lib/personalization-ai';
import { COMFORTABLE_COLORS } from '@/lib/personalization-constants';
import {
  adjustedPriceCents,
  listCatalogItemBoilerplates,
  type PersonalizationBoilerplate,
} from '@/lib/personalization-boilerplates';
import {
  collectSkillPaths,
  createSkillTextLoader,
  hasInjectableSkill,
} from '@/lib/personalization-skills';
import { IMAGE_EXTENSION_BY_MIME, uploadToBucket } from '@/lib/storage';
import { traceAndStoreManufacturingSvgs } from '@/lib/manufacturing-svg';
import { SvgTraceQualityError } from '@/lib/svg-trace';
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

// The manufacturing PNG is the production file, so it is generated at the
// highest quality; the preview only has to reproduce it on the product.
const MANUFACTURING_PNG_SIZE = '1024x1024';
const MANUFACTURING_PNG_QUALITY = 'high';

function errorState(message: string): PersonalizedGenerationState {
  return { code: 'error', message };
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
  folder: 'previews' | 'manufacturing',
) {
  return uploadToBucket(supabase, {
    bucket: 'generated-assets',
    path: `${userId}/personalized-items/${folder}/${crypto.randomUUID()}.png`,
    body: bytes,
    contentType: 'image/png',
  });
}

type ManufacturingSvgOutcome =
  | {
      status: 'generated';
      /** Filled SVG (engrave layer). */
      path: string;
      /** Stroke-only SVG (cut/score layer). */
      strokePath: string;
      trace: { inkCoverage: number; pathCount: number; units: 'mm' | 'px' };
    }
  | { status: 'quality_check_failed'; inkCoverage: number; message: string }
  | { status: 'trace_failed'; message: string };

/**
 * Traces the manufacturing PNG into the production SVGs (fill and stroke) and
 * stores them next to the PNG. A failed trace must not fail the customer's generation: it is
 * logged and reported in the option metadata, leaving the admin "Generate SVG"
 * button as fallback. A quality-check failure means the PNG itself is off
 * (shading, blank page), so the admin should look at it before regenerating.
 */
async function traceManufacturingSvg(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  userId: string,
  pngBytes: Uint8Array,
  artworkWidthMm: number | null,
): Promise<ManufacturingSvgOutcome> {
  try {
    const files = await traceAndStoreManufacturingSvgs(supabase, {
      pngBytes,
      artworkWidthMm,
      directory: `${userId}/personalized-items/manufacturing`,
    });
    return {
      status: 'generated',
      path: files.fillPath,
      strokePath: files.strokePath,
      trace: files.trace,
    };
  } catch (error) {
    console.error('[personalized-item] manufacturing SVG trace failed', { userId, error });
    if (error instanceof SvgTraceQualityError) {
      return {
        status: 'quality_check_failed',
        inkCoverage: error.inkCoverage,
        message: error.message,
      };
    }
    return {
      status: 'trace_failed',
      message: error instanceof Error ? error.message : String(error),
    };
  }
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
      'id, slug, title, price_cents, currency, item_type, status, is_customizable, system_prompt, skill_id, skill_path, tags',
    )
    .eq('id', catalogItemId)
    .eq('status', 'published')
    .maybeSingle();
  if (itemError || !item || !item.is_customizable) return errorState(t('errorItem'));

  const configuredBoilerplates = await listCatalogItemBoilerplates(supabase, item.id);
  if (!item.system_prompt && !configuredBoilerplates.length && !hasInjectableSkill(item)) {
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

  const callTargets: Array<PersonalizationBoilerplate | null> = selectedBoilerplates.length
    ? selectedBoilerplates
    : [null];

  const creditCost = Math.max(callTargets.length, 1);

  // Resolve the AI client before touching credits: a missing OPENAI_API_KEY
  // used to debit, create an empty generated item, then refund — surfacing as
  // a generic "could not generate" message with no server-side log.
  let openAiClient: ReturnType<typeof getOpenAiClient>;
  try {
    openAiClient = getOpenAiClient();
  } catch (error) {
    console.error('[personalized-item] OpenAI client unavailable', error);
    return errorState('Image generation is not configured on this server. Please contact support.');
  }

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
    for (const file of files)
      originalImagePaths.push(await uploadUserImage(supabase, user.id, file));

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
      },
      creditCost,
      reviewStatus: 'preview_ready',
    });
    generatedId = generated.id;

    // Skill text comes from the private uploads-bucket copies (OpenAI forbids
    // downloading user_data file content). Copies live under the uploading
    // admin's folder, so the customer's session client cannot read them —
    // the service client can.
    const loadSkillText = createSkillTextLoader(getServiceSupabase());
    // Styles are independent, so they generate in parallel: a two-step style
    // makes two sequential image calls and would otherwise multiply latency.
    const options = await Promise.all(
      callTargets.map(async (reference, index) => {
        // Two-step styles generate the manufacturing PNG first and render the
        // preview from it, so the customer sees exactly what will be produced.
        // Items without a photo tag (e.g. engraved keepsake boxes) run the step
        // too: their manufacturing prompt builds the artwork from the
        // customer's text alone. Photo items always have their photo here,
        // since it is validated as mandatory above.
        const manufacturingPrompt = reference?.manufacturing_prompt?.trim() || null;
        let manufacturing: {
          path: string;
          bytes: Uint8Array;
          prompt: string;
          svg: Promise<ManufacturingSvgOutcome | null>;
        } | null = null;
        if (manufacturingPrompt) {
          const prompt = composeManufacturingPrompt(
            manufacturingPrompt,
            personalizedText,
            customTextFormatting || null,
          );
          const artwork = await generateOpenAiImage(openAiClient, {
            prompt,
            userImages: files,
            size: MANUFACTURING_PNG_SIZE,
            quality: MANUFACTURING_PNG_QUALITY,
            background: 'opaque',
          });
          manufacturing = {
            path: await uploadGeneratedPng(supabase, user.id, artwork.bytes, 'manufacturing'),
            bytes: artwork.bytes,
            prompt,
            // Only styles that need a vector file (laser engraving) are traced;
            // it runs while the preview renders, so it adds no wait time.
            svg: reference?.generate_hidden_svg
              ? traceManufacturingSvg(
                  supabase,
                  user.id,
                  artwork.bytes,
                  reference.artwork_width_mm ?? null,
                )
              : Promise.resolve(null),
          };
        }

        const prompt = composePersonalizationPrompt({
          systemPrompt: item.system_prompt,
          boilerplateInstruction: reference?.generation_instruction ?? null,
          personalizedText,
          personalizedTextFormatting: customTextFormatting || null,
          colorLabel: selectedColor?.label ?? null,
          colorHex: selectedColor?.hex ?? null,
          hasPhoto,
          fromManufacturingArtwork: Boolean(manufacturing),
        });
        const skillTexts = await Promise.all(collectSkillPaths(item, reference).map(loadSkillText));
        const image = await generateOpenAiImage(openAiClient, {
          prompt,
          skillTexts,
          // The preview is rendered from the manufacturing artwork only; the raw
          // photo would let the model redraw the subject and drift from the file.
          userImages: manufacturing ? [] : files,
          artworkImages: manufacturing ? [manufacturing.bytes] : [],
          referenceFileId: reference?.openai_file_id ?? null,
          size: '1024x1024',
          quality: manufacturing ? 'medium' : 'low',
        });
        const previewPath = await uploadGeneratedPng(supabase, user.id, image.bytes, 'previews');
        const manufacturingSvg = manufacturing ? await manufacturing.svg : null;
        return {
          generatedItemId: generated.id,
          optionIndex: index + 1,
          previewImagePath: previewPath,
          manufacturingFilePath: manufacturing?.path ?? null,
          boilerplateId: reference?.id ?? null,
          metadata: {
            boilerplateId: reference?.id ?? null,
            boilerplateName: reference?.name ?? null,
            manufacturingProcess: reference?.manufacturing_process ?? null,
            requiresManufacturingSvg: reference?.generate_hidden_svg ?? false,
            manufacturingSvgStatus: manufacturingSvg?.status ?? 'pending_admin_generation',
            ...(manufacturingSvg?.status === 'generated'
              ? {
                  manufacturingSvgPath: manufacturingSvg.path,
                  manufacturingSvgStrokePath: manufacturingSvg.strokePath,
                  manufacturingSvgGeneratedAt: new Date().toISOString(),
                  manufacturingSvgTrace: manufacturingSvg.trace,
                }
              : {}),
            ...(manufacturingSvg && manufacturingSvg.status !== 'generated'
              ? {
                  manufacturingSvgError: manufacturingSvg.message,
                  ...(manufacturingSvg.status === 'quality_check_failed'
                    ? { manufacturingSvgTrace: { inkCoverage: manufacturingSvg.inkCoverage } }
                    : {}),
                }
              : {}),
            ...(manufacturing
              ? {
                  manufacturingPngStatus: 'generated',
                  manufacturingPngGeneration: {
                    source: 'customer_generation',
                    prompt: manufacturing.prompt,
                    quality: MANUFACTURING_PNG_QUALITY,
                    format: 'png',
                    generatedAt: new Date().toISOString(),
                  },
                  previewRenderedFromManufacturingPng: true,
                }
              : {}),
            revisedPrompt: image.revisedPrompt,
            validationWarnings: [],
            unitPriceCents: adjustedPriceCents(
              item.price_cents,
              reference?.price_adjustment_percent ?? null,
            ),
            unitCurrency: item.currency,
          },
        };
      }),
    );
    await createPersonalizedPreviewOptions(supabase, options);
  } catch (error) {
    console.error('[personalized-item] generation failed', {
      userId: user.id,
      catalogItemId: item.id,
      generatedId,
      error,
    });
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
    return errorState(
      error instanceof Error ? friendlyGenerationError(error) : t('errorGeneration'),
    );
  }

  if (!generatedId)
    return errorState('We could not save the generated previews. Please try again.');
  redirect(`/generated/${generatedId}`);
}
