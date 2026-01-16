"use server";

import { generateVisualStepImage } from "@zoonk/core/steps/visual-image";
import { parseFormField } from "@zoonk/utils/form";

export async function generateVisualImageAction(formData: FormData) {
  const prompt = parseFormField(formData, "prompt");

  if (!prompt) {
    return { error: "Prompt is required." };
  }

  const { data: imageUrl, error } = await generateVisualStepImage({
    orgSlug: "evals",
    prompt,
  });

  if (error) {
    console.error("Error generating visual image:", error);
    return { error: error.message };
  }

  return { imageUrl, success: true };
}
