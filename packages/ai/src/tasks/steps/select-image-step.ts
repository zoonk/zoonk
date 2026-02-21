import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { type GeneratedFile, type ImageModel, generateImage } from "ai";
import promptTemplate from "./select-image-step.prompt.md";

const DEFAULT_MODEL = "openai/gpt-image-1-mini";
const DEFAULT_QUALITY = "low";

export function getSelectImageStepPrompt(prompt: string) {
  return promptTemplate.replace("{{PROMPT}}", () => prompt);
}

export type SelectImageStepParams = {
  prompt: string;
  model?: ImageModel;
  quality?: "auto" | "low" | "medium" | "high";
};

export async function generateSelectImageStep({
  prompt,
  model = DEFAULT_MODEL,
  quality = DEFAULT_QUALITY,
}: SelectImageStepParams): Promise<SafeReturn<GeneratedFile>> {
  const { data, error } = await safeAsync(() =>
    generateImage({
      maxImagesPerCall: 1,
      model,
      prompt: getSelectImageStepPrompt(prompt),
      providerOptions: {
        openai: { output_format: "webp", quality },
      },
      size: "1024x1024",
    }),
  );

  if (error) {
    console.error("Error generating select image step:", error);
    return { data: null, error };
  }

  return { data: data.image, error: null };
}
