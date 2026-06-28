"use server";

import { parseLanguageAudioModel } from "@zoonk/ai/tasks/audio/models";
import { generateLanguageAudio } from "@zoonk/core/audio/generate";
import { parseFormField } from "@zoonk/utils/form";
import { type TTSVoice } from "@zoonk/utils/languages";
import { logError } from "@zoonk/utils/logger";

export async function generateAudioAction(formData: FormData) {
  const text = parseFormField(formData, "text");
  const voice = parseFormField(formData, "voice") as TTSVoice | undefined;
  const language = parseFormField(formData, "language") || undefined;
  const rawModel = parseFormField(formData, "model");
  const model = parseLanguageAudioModel(rawModel);

  if (!text) {
    return { error: "Text is required." };
  }

  if (rawModel && !model) {
    return { error: "Select a valid audio model." };
  }

  const { data: audioUrl, error } = await generateLanguageAudio({
    language,
    ...(model ? { model } : {}),
    orgSlug: "evals",
    text,
    voice,
  });

  if (error) {
    logError("Error generating audio:", error);
    return { error: error.message };
  }

  return { audioUrl, success: true };
}
