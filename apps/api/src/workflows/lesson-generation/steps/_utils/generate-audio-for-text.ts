import { generateLanguageAudio } from "@zoonk/core/audio/generate";

type AudioUsage = Parameters<typeof generateLanguageAudio>[0]["usage"];
type AudioModel = Parameters<typeof generateLanguageAudio>[0]["model"];
type AudioTextType = Parameters<typeof generateLanguageAudio>[0]["textType"];

/**
 * Generates and uploads audio for one text snippet used by a lesson step.
 *
 * The optional usage flag gives TTS narrow product context, such as
 * alphabet-card pronunciation, without changing the stored source text.
 */
export async function generateAudioForText({
  language,
  model,
  orgSlug,
  text,
  textType,
  usage,
}: {
  language: string;
  model?: AudioModel;
  orgSlug?: string;
  text: string;
  textType?: AudioTextType;
  usage?: AudioUsage;
}): Promise<{ audioUrl: string; text: string }> {
  const { data, error } = await generateLanguageAudio({
    language,
    ...(model ? { model } : {}),
    orgSlug,
    text,
    ...(textType ? { textType } : {}),
    ...(usage ? { usage } : {}),
  });

  if (error || !data) {
    throw error ?? new Error("audioGenerationFailed");
  }

  return { audioUrl: data, text };
}
