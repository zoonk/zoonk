import { generateLanguageAudio } from "@zoonk/core/audio/generate";

export async function generateAudioForText(
  text: string,
  language: string,
  orgSlug?: string,
): Promise<{ audioUrl: string; text: string } | null> {
  const { data, error } = await generateLanguageAudio({
    language,
    orgSlug,
    text,
  });

  if (error || !data) {
    return null;
  }

  return { audioUrl: data, text };
}
