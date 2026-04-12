import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { type GeneratedFile, type ImageModel, generateImage } from "ai";
import { type ImageGenerationQuality, buildImageProviderOptions } from "../../provider-options";
import promptTemplate from "./step-visual-image.prompt.md";

const DEFAULT_MODEL = "openai/gpt-image-1.5";
const DEFAULT_QUALITY = "low";

function getStepVisualImagePrompt(prompt: string, language: string) {
  return promptTemplate.replace("{{PROMPT}}", () => prompt).replace("{{LANGUAGE}}", () => language);
}

export type StepVisualImageParams = {
  prompt: string;
  language: string;
  model?: ImageModel;
  quality?: ImageGenerationQuality;
};

export async function generateStepVisualImage({
  prompt,
  language,
  model = DEFAULT_MODEL,
  quality = DEFAULT_QUALITY,
}: StepVisualImageParams): Promise<SafeReturn<GeneratedFile>> {
  const { data, error } = await safeAsync(() =>
    generateImage({
      maxImagesPerCall: 1,
      model,
      prompt: getStepVisualImagePrompt(prompt, language),
      providerOptions: buildImageProviderOptions({
        model,
        quality,
        taskName: "step-visual-image",
      }),
      size: "1024x1024",
    }),
  );

  if (error) {
    logError("Error generating step visual image:", error);
    return { data: null, error };
  }

  return { data: data.image, error: null };
}
