"use server";

import { generateStepImage } from "@zoonk/core/steps/image";
import { parseFormField } from "@zoonk/utils/form";
import { logError } from "@zoonk/utils/logger";

export async function generateSelectImageAction(formData: FormData) {
  const prompt = parseFormField(formData, "prompt");

  if (!prompt) {
    return { error: "Prompt is required." };
  }

  const { data: imageUrl, error } = await generateStepImage({
    language: "en",
    orgSlug: "evals",
    prompt,
  });

  if (error) {
    logError("Error generating select image:", error);
    return { error: error.message };
  }

  return { imageUrl, success: true };
}
