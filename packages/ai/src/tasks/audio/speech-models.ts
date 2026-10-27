/**
 * Text-to-speech models, in the order a clip tries them when no model is asked for. In the
 * `language-audio` eval (39 words, sentences and passages in 13 languages, each heard by
 * gpt-transcribe and the Gemini pronunciation check; 11 Oct 2026):
 *
 * - Gemini 3.8 Flash TTS (GA, $0.50 per million text tokens in and $9 per million audio tokens
 *   out through Dec 2026). Speech is about 25 audio tokens a second, so a 5-second clip costs
 *   about $0.001. It read 36 of 39 right at 2.4s p50. It goes through AI Gateway, so its cost
 *   shows up with every other gateway call.
 * - Gemini 3.8 Flash Lite TTS ($6 per million audio tokens), the same voices when Flash is busy
 *   or its audio fails the checks: 37 of 39 at 2.0s.
 * - MAI-Voice-2.1 Flash, Microsoft's on AI Gateway (preview, $15 per million characters), for the
 *   23 languages it speaks: 30 of the 34 clips in them at 0.8s. A voice per locale, no free-text
 *   instructions. MAI-Voice-2.1 read as many at 1.6s and $22.
 *
 * MAI-Voice is on another provider, so an outage at Google doesn't silence the listening screens
 * of its languages; its voice differs, which beats no audio. Every model read some single words
 * English spells the same the English way (Gemini Flash: "time" in Brazilian Portuguese and "pain" in
 * French; MAI-Voice: "Name" in German), so such a word gets its IPA, only goes to Gemini Flash
 * and is listened to before it's kept (see `generateLanguageAudio`): 27 of 27 then sounded like
 * their language.
 */
export const speechModels = {
  geminiFlash: "google/gemini-3.8-flash-tts",
  geminiFlashLite: "google/gemini-3.8-flash-lite-tts",
  maiVoiceFlash: "microsoft/mai-voice-2.1-flash",
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
