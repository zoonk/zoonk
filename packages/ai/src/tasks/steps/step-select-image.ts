import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { type GeneratedFile, type ImageModel, generateImage } from "ai";
import promptTemplate from "./step-select-image.prompt.md";

const DEFAULT_MODEL = "openai/gpt-image-1-mini";
const DEFAULT_QUALITY = "low";

function getSelectImageStepPrompt(prompt: string, language: string) {
  return promptTemplate.replace("{{PROMPT}}", () => prompt).replace("{{LANGUAGE}}", () => language);
}

export type SelectImageStepParams = {
  prompt: string;
  language: string;
  model?: ImageModel;
  quality?: "auto" | "low" | "medium" | "high";
};

export async function generateSelectImageStep({
  prompt,
  language,
  model = DEFAULT_MODEL,
  quality = DEFAULT_QUALITY,
}: SelectImageStepParams): Promise<SafeReturn<GeneratedFile>> {
  const { data, error } = await safeAsync(() =>
    generateImage({
      maxImagesPerCall: 1,
      model,
      prompt: getSelectImageStepPrompt(prompt, language),
      providerOptions: {
        openai: { output_format: "webp", quality },
      },
      size: "1024x1024",
    }),
  );

  if (error) {
    logError("Error generating select image step:", error);
    return { data: null, error };
  }

  return { data: data.image, error: null };
}
