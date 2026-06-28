export const LANGUAGE_AUDIO_MODELS = [
  {
    id: "google/gemini-2.5-flash-preview-tts",
    label: "Gemini 2.5 Flash Preview TTS",
    model: "gemini-2.5-flash-preview-tts",
    provider: "Google",
  },
  {
    id: "openai/gpt-4o-mini-tts",
    label: "GPT-4o Mini TTS",
    model: "gpt-4o-mini-tts",
    provider: "OpenAI",
  },
] as const;

export type LanguageAudioModel = (typeof LANGUAGE_AUDIO_MODELS)[number]["id"];

/**
 * Validates form input before it reaches the audio task so the evals UI can
 * offer model selection without letting arbitrary provider strings reach the
 * AI SDK provider factories.
 */
export function parseLanguageAudioModel(
  model: string | null | undefined,
): LanguageAudioModel | undefined {
  return LANGUAGE_AUDIO_MODELS.find((item) => item.id === model)?.id;
}
