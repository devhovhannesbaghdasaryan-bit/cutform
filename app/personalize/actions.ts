"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import {
  createGeneratedItem,
  createPersonalizedPreviewOptions,
} from "@/lib/generated-items";
import { PERSONALIZED_NIGHT_LIGHT } from "@/lib/marketplace-constants";
import { generateOpenAiImage } from "@/lib/openai-image";
import {
  buildPersonalizedNightLightOpenAiPayload,
} from "@/lib/personalized-night-light-ai";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import { debitCredits, getCreditBalance, refundCredits } from "@/lib/credits";
import type { PersonalizationBoilerplate } from "@/lib/personalization-boilerplates";
import { translate } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";

export type PersonalizedGenerationState = {
  code: "idle" | "error" | "insufficient_credits";
  message: string | null;
  requiredCredits?: number;
  availableCredits?: number;
};

function errorState(message: string): PersonalizedGenerationState {
  return { code: "error", message };
}

function friendlyGenerationError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (
    message.includes("billing hard limit") ||
    message.includes("billing limit")
  ) {
    return "Image generation is temporarily unavailable because the AI service billing limit was reached. Please try again later or contact support. Any generation credits were refunded.";
  }
  if (message.includes("rate limit") || message.includes("too many requests")) {
    return "The image service is busy right now. Please wait a moment and try again. Any generation credits were refunded.";
  }
  return "We could not generate your night-light previews. Please try again. Any generation credits were refunded.";
}

const imageExtByMime: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function getImageFiles(formData: FormData) {
  return formData
    .getAll("images")
    .filter((value): value is File => value instanceof File && value.size > 0);
}

function summarizeTextFormatting(value: FormDataEntryValue | null) {
  const html = typeof value === "string" ? value.slice(0, 2_000) : "";
  const styles = [
    /<(b|strong)(\s|>)/i.test(html) ? "bold emphasis" : null,
    /<(i|em)(\s|>)/i.test(html) ? "italic emphasis" : null,
    /text-align\s*:\s*center|align=["']?center/i.test(html)
      ? "center aligned"
      : "left aligned",
  ].filter(Boolean);
  return styles.join(", ");
}

function resolveModelPriceCents(formSchema: Record<string, unknown>) {
  const configured = Number(formSchema.basePriceCents);
  return Number.isFinite(configured) && configured >= 0
    ? Math.round(configured)
    : PERSONALIZED_NIGHT_LIGHT.defaultPriceCents;
}

async function uploadUserImage(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  userId: string,
  file: File,
) {
  const ext = imageExtByMime[file.type];
  if (!ext) throw new Error("Upload PNG, JPG, or WEBP images only.");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Images must be 20 MB or smaller.");
  const path = `${userId}/personalized-night-lights/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("user-uploads")
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });
  if (error) throw new Error(error.message);
  return path;
}

async function uploadGeneratedPng(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  userId: string,
  folder: string,
  bytes: Uint8Array,
) {
  const path = `${userId}/personalized-night-lights/${folder}/${crypto.randomUUID()}.png`;
  const { error } = await supabase.storage
    .from("generated-assets")
    .upload(path, bytes, { contentType: "image/png", upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

async function loadBoilerplate(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  reference: PersonalizationBoilerplate,
) {
  let bytes: Uint8Array;
  if (reference.image_path.startsWith("/")) {
    bytes = new Uint8Array(await readFile(path.join(process.cwd(), "public", ...reference.image_path.split("/").filter(Boolean))));
  } else {
    const { data, error } = await supabase.storage.from("catalog-assets").download(reference.image_path);
    if (error || !data) throw new Error(error?.message ?? "Unable to load boilerplate image.");
    bytes = new Uint8Array(await data.arrayBuffer());
  }
  const extension = reference.image_path.split(".").pop()?.toLowerCase();
  const mime = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : extension === "svg" ? "image/svg+xml" : "image/jpeg";
  return new File([Uint8Array.from(bytes).buffer], `boilerplate.${extension || "jpg"}`, { type: mime });
}

export async function generatePersonalizedNightLightAction(
  _previousState: PersonalizedGenerationState,
  formData: FormData,
): Promise<PersonalizedGenerationState> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const modelId = String(formData.get("modelId") ?? "");
  if (!user)
    redirect(`/login?next=/personalize/${encodeURIComponent(modelId)}`);
  const locale = await getRequestLocale();
  const t = (key: string) => translate(locale, `nightLight.${key}`);

  const files = getImageFiles(formData);
  if (files.length !== PERSONALIZED_NIGHT_LIGHT.maxImages) {
    return errorState(t("errorUpload"));
  }
  const customText = String(formData.get("customText") ?? "").trim();
  if (customText.length > PERSONALIZED_NIGHT_LIGHT.maxTextLength) {
    return errorState(
      t("errorText"),
    );
  }
  const customTextFormatting = summarizeTextFormatting(
    formData.get("customTextHtml"),
  );
  const allowedColors = new Set(
    PERSONALIZED_NIGHT_LIGHT.comfortableLedColors.map((color) => color.value),
  );
  const requestedColor = String(
    formData.get("ledColor") ?? PERSONALIZED_NIGHT_LIGHT.defaultLedColor,
  );
  const ledColor = allowedColors.has(
    requestedColor as (typeof PERSONALIZED_NIGHT_LIGHT.comfortableLedColors)[number]["value"],
  )
    ? requestedColor
    : PERSONALIZED_NIGHT_LIGHT.defaultLedColor;
  const multiColor = false;

  const { data: model, error: modelError } = await supabase
    .from("personalization_models")
    .select("id, slug, title, boilerplate_image_path, status, form_schema")
    .eq("id", modelId)
    .eq("status", "published")
    .maybeSingle<{
      id: string;
      slug: string;
      title: string;
      boilerplate_image_path: string | null;
      status: string;
      form_schema: Record<string, unknown>;
    }>();

  if (modelError || !model)
    return errorState(t("errorModel"));

  const requestedBoilerplateIds = [...new Set(
    formData.getAll("boilerplateIds").filter((value): value is string => typeof value === "string"),
  )];
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

    console.log("[personalized-night-light] request payload", requestPayload);

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
        purpose: "edit",
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
        hiddenSvgPath: null,
        boilerplateId: reference.id,
        metadata: {
          modelId: model.id,
          optionIndex: index,
          boilerplateId: reference.id,
          boilerplateName: reference.admin_name,
          manufacturingProcess: reference.manufacturing_process,
          boilerplatePath: reference.image_path,
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
