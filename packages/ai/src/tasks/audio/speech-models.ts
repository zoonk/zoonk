export const speechModels = {
  google: "google/gemini-2.5-flash-preview-tts",
  openai: "openai/gpt-4o-mini-tts",
} as const;

export type SpeechModelName = (typeof speechModels)[keyof typeof speechModels];

const speechModelNames: readonly string[] = Object.values(speechModels);

/**
 * Validates model names received at runtime before they reach the typed audio
 * generation boundary. Form submissions are untrusted strings even when the
 * UI only renders supported options, so the server action must narrow them.
 */
export function isSpeechModelName(value: string): value is SpeechModelName {
  return speechModelNames.includes(value);
}
