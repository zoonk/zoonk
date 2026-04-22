import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { type GeneratedFile, type ImageModel, generateImage } from "ai";
import { type ImageGenerationQuality, buildImageProviderOptions } from "../../provider-options";
import promptTemplate from "./course-thumbnail.prompt.md";

const DEFAULT_MODEL = "openai/gpt-image-2";
const DEFAULT_QUALITY = "low";

function getCourseThumbnailPrompt(title: string) {
  return promptTemplate.replace("{{TITLE}}", () => title);
}

export type CourseThumbnailParams = {
  title: string;
  model?: ImageModel;
  quality?: ImageGenerationQuality;
};

export async function generateCourseThumbnail({
  title,
  model = DEFAULT_MODEL,
  quality = DEFAULT_QUALITY,
}: CourseThumbnailParams): Promise<SafeReturn<GeneratedFile>> {
  const { data, error } = await safeAsync(() =>
    generateImage({
      maxImagesPerCall: 1,
      model,
      prompt: getCourseThumbnailPrompt(title),
      providerOptions: buildImageProviderOptions({
        model,
        quality,
        taskName: "course-thumbnail",
      }),
      size: "1024x1024",
    }),
  );

  if (error) {
    logError("Error generating course thumbnail:", error);
    return { data: null, error };
  }

  return { data: data.image, error: null };
}
