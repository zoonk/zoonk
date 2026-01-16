import { openai } from "@ai-sdk/openai";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { type GeneratedFile, generateImage, type ImageModel } from "ai";
import promptTemplate from "./course-thumbnail.prompt.md";

const DEFAULT_MODEL = openai.image("gpt-image-1-mini");
const DEFAULT_QUALITY = "low";

export function getCourseThumbnailPrompt(title: string) {
  return promptTemplate.replace("{{TITLE}}", title);
}

export type CourseThumbnailParams = {
  title: string;
  model?: ImageModel;
  quality?: "auto" | "low" | "medium" | "high";
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
      providerOptions: {
        openai: { output_format: "webp", quality },
      },
      size: "1024x1024",
    }),
  );

  if (error) {
    console.error("Error generating course thumbnail:", error);
    return { data: null, error };
  }

  return { data: data.image, error: null };
}
