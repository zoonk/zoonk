import { openai } from "@ai-sdk/openai";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { type GeneratedFile, generateImage, type ImageModel } from "ai";
import promptTemplate from "./step-visual-image.prompt.md";

const DEFAULT_MODEL = openai.image("gpt-image-1.5");
const DEFAULT_QUALITY = "low";

export function getStepVisualImagePrompt(prompt: string) {
  return promptTemplate.replace("{{PROMPT}}", () => prompt);
}

export type StepVisualImageParams = {
  prompt: string;
  model?: ImageModel;
  quality?: "auto" | "low" | "medium" | "high";
};

export async function generateStepVisualImage({
  prompt,
  model = DEFAULT_MODEL,
  quality = DEFAULT_QUALITY,
}: StepVisualImageParams): Promise<SafeReturn<GeneratedFile>> {
  const { data, error } = await safeAsync(() =>
    generateImage({
      maxImagesPerCall: 1,
      model,
      prompt: getStepVisualImagePrompt(prompt),
      providerOptions: {
        openai: { output_format: "webp", quality },
      },
      size: "1024x1024",
    }),
  );

  if (error) {
    console.error("Error generating step visual image:", error);
    return { data: null, error };
  }

  return { data: data.image, error: null };
}
