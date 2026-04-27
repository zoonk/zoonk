import { AI_TASK_MODEL_CONFIG } from "@zoonk/ai/tasks/metadata";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { type GeneratedFile, type ImageModel, generateImage } from "ai";
import { type ImageGenerationQuality, buildImageProviderOptions } from "../../provider-options";
import promptTemplate from "./course-thumbnail.prompt.md";

const taskName = "course-thumbnail";
const { defaultModel } = AI_TASK_MODEL_CONFIG[taskName];
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
  model = defaultModel,
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
        taskName,
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
