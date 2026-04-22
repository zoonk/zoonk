import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { type GeneratedFile, type ImageModel, generateImage } from "ai";
import { type ImageGenerationQuality, buildImageProviderOptions } from "../../provider-options";
import promptTemplate from "./step-content-image.prompt.md";

const DEFAULT_MODEL = "openai/gpt-image-2";
const DEFAULT_QUALITY = "low";

function getStepContentImagePrompt(prompt: string, language: string) {
  return promptTemplate.replace("{{PROMPT}}", () => prompt).replace("{{LANGUAGE}}", () => language);
}

export type StepContentImageParams = {
  prompt: string;
  language: string;
  model?: ImageModel;
  quality?: ImageGenerationQuality;
};

export async function generateStepContentImage({
  prompt,
  language,
  model = DEFAULT_MODEL,
  quality = DEFAULT_QUALITY,
}: StepContentImageParams): Promise<SafeReturn<GeneratedFile>> {
  const { data, error } = await safeAsync(() =>
    generateImage({
      maxImagesPerCall: 1,
      model,
      prompt: getStepContentImagePrompt(prompt, language),
      providerOptions: buildImageProviderOptions({
        model,
        quality,
        taskName: "step-content-image",
      }),
      size: "1024x1024",
    }),
  );

  if (error) {
    logError("Error generating step content image:", error);
    return { data: null, error };
  }

  return { data: data.image, error: null };
}
