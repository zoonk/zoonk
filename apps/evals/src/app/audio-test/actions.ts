"use server";

import { generateLanguageAudio } from "@zoonk/core/audio/generate";
import { parseFormField } from "@zoonk/utils/form";
import { type TTSVoice } from "@zoonk/utils/languages";
import { logError } from "@zoonk/utils/logger";
import { DEFAULT_AUDIO_MODEL_VALUE, getSpeechModel, isAudioModelValue } from "./models";

export async function generateAudioAction(formData: FormData) {
  const text = parseFormField(formData, "text");
  const voice = parseFormField(formData, "voice") as TTSVoice | undefined;
  const language = parseFormField(formData, "language") || undefined;
  const modelValue = parseFormField(formData, "model") ?? DEFAULT_AUDIO_MODEL_VALUE;

  if (!text) {
    return { error: "Text is required." };
  }

  if (!isAudioModelValue(modelValue)) {
    return { error: "Select a supported audio model." };
  }

  const model = getSpeechModel(modelValue);

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
