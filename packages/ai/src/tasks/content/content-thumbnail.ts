import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { type GeneratedFile, type ImageModel, generateImage } from "ai";
import { type ImageGenerationQuality, buildImageProviderOptions } from "../../provider-options";
import promptTemplate from "./content-thumbnail.prompt.md";

const defaultModel = "openai/gpt-image-2";
const DEFAULT_QUALITY = "low";

/**
 * Keeps thumbnail prompt assembly in one place so every curriculum thumbnail
 * asks for the same app-icon treatment while optional context can disambiguate
 * broad titles like "Energy" or "Arrays".
 */
function getContentThumbnailPrompt({
  description,
  title,
}: {
  description: string | null | undefined;
  title: string;
}) {
  return promptTemplate
    .replace("{{CONTEXT}}", () => description ?? "")
    .replace("{{TITLE}}", () => title);
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
    generateImage({
      maxImagesPerCall: 1,
      model,
      prompt: getContentThumbnailPrompt({ description, title }),
      providerOptions: buildImageProviderOptions({ quality }),
      size: "1024x1024",
    }),
  );

  if (error) {
    logError("Error generating content thumbnail:", error);
    return { data: null, error };
  }

  return { data: data.image, error: null };
}
