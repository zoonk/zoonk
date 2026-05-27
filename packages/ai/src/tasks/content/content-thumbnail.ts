import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { type GeneratedFile, type ImageModel } from "ai";
import { type ImageGenerationQuality, buildImageProviderOptions } from "../../provider-options";
import { generateImageWithSafetyRetry } from "../_utils/generate-image-with-safety-retry";
import promptTemplate from "./content-thumbnail.prompt.md";

const defaultModel = "openai/gpt-image-2";
const DEFAULT_QUALITY = "low";

const fallbackModels = [
  "bfl/flux-kontext-max",
  "xai/grok-imagine-image",
  "bytedance/seedream-5.0-lite",
  "recraft/recraft-v4.1-utility",
] as const;

/**
 * Keeps thumbnail prompt assembly in one place so every curriculum thumbnail
 * asks for the same app-icon treatment while optional context can disambiguate
 * broad titles like "Energy" or "Arrays".
 */
function getContentThumbnailPrompt({ input }: { input: string }) {
  return promptTemplate.replace("{{INPUT}}", () => input);
}

/**
 * Keeps the caller-owned content separate from the stable art-direction prompt.
 * Safety retries rewrite only this input so the thumbnail template itself does
 * not drift when a protected topic needs a safer metaphor.
 */
function getContentThumbnailInput({
  description,
  title,
}: {
  description: string | null | undefined;
  title: string;
}) {
  return [`TOPIC: ${title}`, description ? `CONTEXT: ${description}` : ""]
    .filter(Boolean)
    .join("\n");
}

export type ContentThumbnailParams = {
  description?: string | null;
  title: string;
  model?: ImageModel;
  quality?: ImageGenerationQuality;
};

/**
 * Generates the raw thumbnail image for a curriculum topic. Uploading and
 * storage naming stay outside this AI task so workflows can reuse the same
 * generation behavior without leaking storage categories into the prompt.
 */
export async function generateContentThumbnail({
  description,
  title,
  model = defaultModel,
  quality = DEFAULT_QUALITY,
}: ContentThumbnailParams): Promise<SafeReturn<GeneratedFile>> {
  const { data, error } = await safeAsync(() =>
    generateImageWithSafetyRetry({
      buildPrompt: getContentThumbnailPrompt,
      input: getContentThumbnailInput({ description, title }),
      maxImagesPerCall: 1,
      model,
      providerOptions: buildImageProviderOptions({ fallbackModels, quality }),
      size: "1024x1024",
    }),
  );

  if (error) {
    logError("Error generating content thumbnail:", error);
    return { data: null, error };
  }

  return { data: data.image, error: null };
}
