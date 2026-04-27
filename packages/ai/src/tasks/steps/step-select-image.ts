import { AI_TASK_MODEL_CONFIG } from "@zoonk/ai/tasks/metadata";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { type GeneratedFile, type ImageModel, generateImage } from "ai";
import { type ImageGenerationQuality, buildImageProviderOptions } from "../../provider-options";
import promptTemplate from "./step-select-image.prompt.md";

const taskName = "step-select-image";
const { defaultModel } = AI_TASK_MODEL_CONFIG[taskName];
const DEFAULT_QUALITY = "low";

function getSelectImageStepPrompt(prompt: string, language: string) {
  return promptTemplate.replace("{{PROMPT}}", () => prompt).replace("{{LANGUAGE}}", () => language);
}

export type SelectImageStepParams = {
  prompt: string;
  language: string;
  model?: ImageModel;
  quality?: ImageGenerationQuality;
};

export async function generateSelectImageStep({
  prompt,
  language,
  model = defaultModel,
  quality = DEFAULT_QUALITY,
}: SelectImageStepParams): Promise<SafeReturn<GeneratedFile>> {
  const { data, error } = await safeAsync(() =>
    generateImage({
      maxImagesPerCall: 1,
      model,
      prompt: getSelectImageStepPrompt(prompt, language),
      providerOptions: buildImageProviderOptions({
        model,
        quality,
        taskName,
      }),
      size: "1024x1024",
    }),
  );

  if (error) {
    logError("Error generating select image step:", error);
    return { data: null, error };
  }

  return { data: data.image, error: null };
}
