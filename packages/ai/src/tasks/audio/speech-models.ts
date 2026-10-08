/**
 * Text-to-speech models, in the order a clip tries them when no model is asked for (checked 6 Oct
 * 2026):
 *
 * - Gemini 3.8 Flash TTS (GA, $0.50 per million text tokens in and $9 per million audio tokens
 *   out through Dec 2026). Speech is about 25 audio tokens a second, so a 5-second clip costs
 *   about $0.001. It goes through AI Gateway, so its cost shows up with every other gateway call.
 * - Gemini 3.8 Flash Lite TTS ($6 per million audio tokens), the same voices when Flash is busy
 *   or its audio fails the checks.
 * - gpt-4o-mini-tts, called on OpenAI directly because AI Gateway only lists tts-1, and only for
 *   languages OpenAI supports. It's the one fallback on another provider, so an outage at Google
 *   doesn't silence every listening screen; its voice differs, which beats no audio.
 */
export const speechModels = {
  geminiFlash: "google/gemini-3.8-flash-tts",
  geminiFlashLite: "google/gemini-3.8-flash-lite-tts",
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
