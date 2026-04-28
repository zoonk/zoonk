import { generateLanguageAudio } from "@zoonk/core/audio/generate";

export async function generateAudioForText(
  text: string,
  language: string,
  orgSlug?: string,
): Promise<{ audioUrl: string; text: string }> {
  const { data, error } = await generateLanguageAudio({
    language,
    orgSlug,
    text,
  });

  if (error || !data) {
    throw error ?? new Error("audioGenerationFailed");
  }

  return { audioUrl: data, text };
}
