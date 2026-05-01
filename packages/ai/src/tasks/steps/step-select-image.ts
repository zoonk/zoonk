import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { type GeneratedFile, type ImageModel, generateImage } from "ai";
import { type ImageGenerationQuality, buildImageProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import promptTemplate from "./step-select-image.prompt.md";

const defaultModel = "openai/gpt-image-2";
const DEFAULT_QUALITY = "low";

/**
 * Builds the final select-image prompt with an expanded language name so the
 * generated option labels use the same locale dialect as the rest of the lesson.
 */
function getSelectImageStepPrompt({ language, prompt }: { language: string; prompt: string }) {
  const promptLanguage = getPromptLanguageName({ language });

  return promptTemplate
    .replace("{{PROMPT}}", () => prompt)
    .replace("{{LANGUAGE}}", () => promptLanguage);
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
      prompt: getSelectImageStepPrompt({ language, prompt }),
      providerOptions: buildImageProviderOptions({ quality }),
      size: "1024x1024",
    }),
  );

  if (error) {
    logError("Error generating select image step:", error);
    return { data: null, error };
  }

  return { data: data.image, error: null };
}
