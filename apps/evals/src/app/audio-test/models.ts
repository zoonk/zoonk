import { type SpeechModelName, isSpeechModelName, speechModels } from "@zoonk/ai/speech-models";

export const DEFAULT_AUDIO_MODEL_VALUE = "default";

export const AUDIO_MODEL_OPTIONS = [
  { label: "Default (Gemini with OpenAI fallback)", value: DEFAULT_AUDIO_MODEL_VALUE },
  { label: "Gemini 2.5 Flash TTS", value: speechModels.google },
  { label: "GPT-4o mini TTS (Marin voice)", value: speechModels.openai },
] as const;

export type AudioModelValue = (typeof AUDIO_MODEL_OPTIONS)[number]["value"];

/**
 * Confirms that a submitted value matches one of the options rendered by the
 * audio test form. Server actions remain directly callable, so this check must
 * not rely on the client-side select restricting its values.
 */
export function isAudioModelValue(value: string): value is AudioModelValue {
  return value === DEFAULT_AUDIO_MODEL_VALUE || isSpeechModelName(value);
}

/**
 * Converts the form's explicit default option into an omitted model so the
 * generation task exercises its Gemini-first, OpenAI-fallback policy.
 */
export function getSpeechModel(value: AudioModelValue): SpeechModelName | undefined {
  return value === DEFAULT_AUDIO_MODEL_VALUE ? undefined : value;
}
