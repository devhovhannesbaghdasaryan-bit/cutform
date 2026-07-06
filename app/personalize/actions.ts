"use server";

import { redirect } from "next/navigation";
import {
  generationFormSchema,
  getImageFiles,
  resolveModelPriceCents,
  summarizeTextFormatting,
} from "@/app/personalize/form-parsing";
import {
  createGeneratedItem,
  createPersonalizedPreviewOptions,
} from "@/lib/generated-items";
import { PERSONALIZED_NIGHT_LIGHT } from "@/lib/marketplace-constants";
import { generateOpenAiImage } from "@/lib/openai-image";
import {
  buildPersonalizedNightLightOpenAiPayload,
  friendlyGenerationError,
} from "@/lib/personalized-night-light-ai";
import { IMAGE_EXTENSION_BY_MIME, uploadToBucket } from "@/lib/storage";
import { getCurrentUser, getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import { debitCredits, getCreditBalance, refundCredits } from "@/lib/credits";
import {
  loadBoilerplate,
  type PersonalizationBoilerplate,
} from "@/lib/personalization-boilerplates";
import { getTranslations } from "next-intl/server";

// Sanctioned exception to the ActionState convention (lib/action-state.ts):
// the credits dialog in components/personalized-night-light-form.tsx needs the
// richer `insufficient_credits` code plus required/available credit counts.
export type PersonalizedGenerationState = {
  code: "idle" | "error" | "insufficient_credits";
  message: string | null;
  requiredCredits?: number;
  availableCredits?: number;
};

function errorState(message: string): PersonalizedGenerationState {
  return { code: "error", message };
}

async function uploadUserImage(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  userId: string,
  file: File,
) {
  const ext = IMAGE_EXTENSION_BY_MIME[file.type];
  if (!ext) throw new Error("Upload PNG, JPG, or WEBP images only.");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Images must be 20 MB or smaller.");
  return uploadToBucket(supabase, {
    bucket: "user-uploads",
    path: `${userId}/personalized-night-lights/${crypto.randomUUID()}.${ext}`,
    body: await file.arrayBuffer(),
    contentType: file.type,
  });
}

async function uploadGeneratedPng(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  userId: string,
  folder: string,
  bytes: Uint8Array,
) {
  return uploadToBucket(supabase, {
    bucket: "generated-assets",
    path: `${userId}/personalized-night-lights/${folder}/${crypto.randomUUID()}.png`,
    body: bytes,
    contentType: "image/png",
  });
}

export async function generatePersonalizedNightLightAction(
  _previousState: PersonalizedGenerationState,
  formData: FormData,
): Promise<PersonalizedGenerationState> {
  const supabase = await getServerSupabase();
  const user = await getCurrentUser();
  const rawModelId = String(formData.get("modelId") ?? "");
  if (!user)
    redirect(`/login?next=/personalize/${encodeURIComponent(rawModelId)}`);
  const t = await getTranslations("nightLight");

  const parsed = generationFormSchema.safeParse({
    modelId: rawModelId,
    customText: String(formData.get("customText") ?? ""),
    ledColor: formData.get("ledColor"),
    images: getImageFiles(formData),
    boilerplateIds: formData.getAll("boilerplateIds"),
  });
  if (!parsed.success) {
    // Localized error selection stays here; ordering mirrors the original
    // sequential checks (upload count first, then text length, then model).
    const invalidFields = new Set(
      parsed.error.issues.map((issue) => issue.path[0]),
    );
    if (invalidFields.has("images")) return errorState(t("errorUpload"));
    if (invalidFields.has("customText")) return errorState(t("errorText"));
    return errorState(t("errorModel"));
  }
  const { modelId, customText, ledColor, images: files } = parsed.data;
  const customTextFormatting = summarizeTextFormatting(
    formData.get("customTextHtml"),
  );
  const multiColor = false;

  const { data: model, error: modelError } = await supabase
    .from("personalization_models")
    .select("id, slug, title, boilerplate_image_path, status, form_schema")
    .eq("id", modelId)
    .eq("status", "published")
    .maybeSingle();

  if (modelError || !model)
    return errorState(t("errorModel"));

  const requestedBoilerplateIds = parsed.data.boilerplateIds;
  if (!requestedBoilerplateIds.length) return errorState(t("selectAtLeastOne"));
  const { data: selectedBoilerplates, error: boilerplateError } = await supabase
    .from("personalization_boilerplates")
    .select("id, model_id, admin_name, name_en, name_hy, name_ru, image_path, manufacturing_process, generation_instruction, generate_hidden_svg, is_active, sort_order")
    .eq("model_id", model.id)
    .eq("is_active", true)
    .in("id", requestedBoilerplateIds)
    .order("sort_order")
    .returns<PersonalizationBoilerplate[]>();
  if (boilerplateError || !selectedBoilerplates || selectedBoilerplates.length !== requestedBoilerplateIds.length) {
    return errorState(t("errorStyle"));
  }

  const creditCost = selectedBoilerplates.length;
  let debited = false;
  let generatedId: string | null = null;
  let creditSupabase: ReturnType<typeof getServiceSupabase> | null = null;
  if (creditCost > 0) {
    try {
      creditSupabase = getServiceSupabase();
      const availableCredits = await getCreditBalance(creditSupabase!, user.id);
      if (availableCredits < creditCost) {
        return {
          code: "insufficient_credits",
          message: `You need ${creditCost} credits to generate these previews, but you have ${availableCredits}.`,
          requiredCredits: creditCost,
          availableCredits,
        };
      }
      await debitCredits(creditSupabase!, {
        userId: user.id,
        amount: creditCost,
        referenceType: "personalized_night_light",
        metadata: {
          modelId: model.id,
          modelSlug: model.slug,
          boilerplateIds: requestedBoilerplateIds,
        },
      });
      debited = true;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes("insufficient credit")
      ) {
        return {
          code: "insufficient_credits",
          message: "You do not have enough credits to generate these previews.",
          requiredCredits: creditCost,
        };
      }
      return errorState(
        t("errorBalance"),
      );
    }
  }

  try {
    const originalImagePaths = [];
    for (const file of files)
      originalImagePaths.push(await uploadUserImage(supabase, user.id, file));

    const requestPayload = buildPersonalizedNightLightOpenAiPayload({
      modelId: model.id,
      modelSlug: model.slug,
      modelTitle: model.title,
      boilerplateImagePath: model.boilerplate_image_path,
      userImagePaths: originalImagePaths,
      customText,
      customTextFormatting,
      ledColor,
      multiColor,
      comfortableColors: PERSONALIZED_NIGHT_LIGHT.comfortableLedColors.map(
        (color) => ({ ...color }),
      ),
    });

    const generated = await createGeneratedItem(supabase, {
      userId: user.id,
      generatedBy: user.id,
      productType: "personalized_night_light",
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
        boilerplateIds: selectedBoilerplates.map((item) => item.id),
        openAiRequest: requestPayload,
        previewDisclaimerAccepted: true,
        customTextFormatting,
        salePriceCents: resolveModelPriceCents(model.form_schema),
        saleCurrency: "AMD",
      },
      creditCost,
      reviewStatus: "preview_ready",
    });
    generatedId = generated.id;

    const options = [];
    for (let offset = 0; offset < selectedBoilerplates.length; offset += 1) {
      const index = offset + 1;
      const reference = selectedBoilerplates[offset];
      const boilerplate = await loadBoilerplate(supabase, reference);
      const image = await generateOpenAiImage({
        prompt: `${requestPayload.prompt}\n\nCreate the selected ${reference.admin_name} preview using manufacturing process ${reference.manufacturing_process}. ${reference.generation_instruction} The final preview must show this boilerplate product customized with the user-submitted subject; do not return the blank boilerplate.`,
        images: [...files, boilerplate],
        size: "1024x1024",
        quality: "low",
      });
      const previewPath = await uploadGeneratedPng(
        supabase,
        user.id,
        "previews",
        image.bytes,
      );
      options.push({
        generatedItemId: generated.id,
        optionIndex: index,
        previewImagePath: previewPath,
        manufacturingFilePath: null,
        boilerplateId: reference.id,
        metadata: {
          modelId: model.id,
          optionIndex: index,
          boilerplateId: reference.id,
          boilerplateName: reference.admin_name,
          manufacturingProcess: reference.manufacturing_process,
          boilerplatePath: reference.image_path,
          // NOTE: 'requiresManufacturingSvg' and 'manufacturingSvgStatus' are stored jsonb
          // keys inside personalized_preview_options.metadata. Existing rows carry them, so
          // the keys are intentionally NOT renamed; the asset they track is a PNG.
          requiresManufacturingSvg: reference.generate_hidden_svg,
          manufacturingSvgStatus: "pending_admin_generation",
          revisedPrompt: image.revisedPrompt,
          validationWarnings: [],
        },
      });
    }
    await createPersonalizedPreviewOptions(supabase, options);
  } catch (error) {
    if (debited) {
      try {
        await refundCredits(creditSupabase!, {
          userId: user.id,
          amount: creditCost,
          referenceType: "personalized_night_light",
          referenceId: generatedId,
          metadata: {
            modelId: model.id,
            reason:
              error instanceof Error
                ? error.message
                : "personalized_generation_failed",
          },
        });
      } catch (refundError) {
        console.error(
          "[personalized-night-light] credit refund failed",
          refundError,
        );
      }
    }
    return errorState(error instanceof Error ? friendlyGenerationError(error) : t("errorGeneration"));
  }

  if (!generatedId)
    return errorState(
      "We could not save the generated previews. Please try again.",
    );
  redirect(`/generated/${generatedId}`);
}
