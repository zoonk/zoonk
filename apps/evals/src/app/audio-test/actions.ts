"use server";

import { generateLanguageAudio } from "@zoonk/core/audio/generate";
import type { TTSVoice } from "@zoonk/utils/constants";
import { parseFormField } from "@zoonk/utils/form";

export async function generateAudioAction(formData: FormData) {
  const text = parseFormField(formData, "text");
  const voice = parseFormField(formData, "voice") as TTSVoice | undefined;
  const language = parseFormField(formData, "language") || undefined;

  if (!text) {
    return { error: "Text is required." };
  }

  const { data: audioUrl, error } = await generateLanguageAudio({
    language,
    orgSlug: "evals",
    text,
    voice,
  });

  if (error) {
    console.error("Error generating audio:", error);
    return { error: error.message };
  }

  return { audioUrl, success: true };
}
