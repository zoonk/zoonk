import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { type GeneratedFile, type ImageModel } from "ai";
import { type ImageGenerationQuality, buildImageProviderOptions } from "../../provider-options";
import { generateImageWithSafetyRetry } from "../_utils/generate-image-with-safety-retry";
import { getPromptLanguageName } from "../_utils/prompt-language";
import illustrationPromptTemplate from "./step-content-image.prompt.md";
import practicePromptTemplate from "./step-content-practice-image.prompt.md";

const defaultModel = "openai/gpt-image-2";
const DEFAULT_QUALITY = "low";

const fallbackModels = [
  "bfl/flux-kontext-max",
  "xai/grok-imagine-image",
  "bytedance/seedream-5.0-lite",
  "recraft/recraft-v4.1-utility",
] as const;

const STEP_CONTENT_IMAGE_PRESETS = {
  illustration: { promptTemplate: illustrationPromptTemplate, size: "1024x1280" },
  practice: { promptTemplate: practicePromptTemplate, size: "1024x1280" },
} as const;

export type StepContentImagePreset = keyof typeof STEP_CONTENT_IMAGE_PRESETS;

const DEFAULT_PRESET: StepContentImagePreset = "illustration";

/**
 * Builds the final image prompt with the same language naming used by text
 * tasks. Image models need the dialect spelled out too because visible labels
 * and UI text inside generated images should match the learner's locale.
 */
function getStepContentImagePrompt({
  language,
  preset,
  prompt,
}: {
  language: string;
  preset: StepContentImagePreset;
  prompt: string;
}) {
  const promptLanguage = getPromptLanguageName({ language });

  return STEP_CONTENT_IMAGE_PRESETS[preset].promptTemplate
    .replace("{{PROMPT}}", () => prompt)
    .replace("{{LANGUAGE}}", () => promptLanguage);
}

export type StepContentImageParams = {
  language: string;
  model?: ImageModel;
  preset?: StepContentImagePreset;
  prompt: string;
  quality?: ImageGenerationQuality;
};

export async function generateStepContentImage({
  language,
  model = defaultModel,
  preset = DEFAULT_PRESET,
  prompt,
  quality = DEFAULT_QUALITY,
}: StepContentImageParams): Promise<SafeReturn<GeneratedFile>> {
  const imagePreset = STEP_CONTENT_IMAGE_PRESETS[preset];

  const { data, error } = await safeAsync(() =>
    generateImageWithSafetyRetry({
      buildPrompt: ({ input }) => getStepContentImagePrompt({ language, preset, prompt: input }),
      input: prompt,
      maxImagesPerCall: 1,
      model,
      providerOptions: buildImageProviderOptions({ fallbackModels, quality }),
      size: imagePreset.size,
    }),
  );

  if (error) {
    logError("Error generating step content image:", error);
    return { data: null, error };
  }

  return { data: data.image, error: null };
}
