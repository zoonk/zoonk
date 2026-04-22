"use server";

import { generateContentStepImage } from "@zoonk/core/steps/content-image";
import { parseFormField } from "@zoonk/utils/form";
import { logError } from "@zoonk/utils/logger";

export async function generateStepImageAction(formData: FormData) {
  const prompt = parseFormField(formData, "prompt");

  if (!prompt) {
    return { error: "Prompt is required." };
  }

  const { data: imageUrl, error } = await generateContentStepImage({
    language: "en",
    orgSlug: "evals",
    prompt,
  });

  if (error) {
    logError("Error generating step image:", error);
    return { error: error.message };
  }

  return { imageUrl, success: true };
}
