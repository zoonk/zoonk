import { type SpeechModelName, isSpeechModelName, speechModels } from "@zoonk/ai/speech-models";

export const DEFAULT_AUDIO_MODEL_VALUE = "default";

export const AUDIO_MODEL_OPTIONS = [
  {
    label: "Default (Gemini 3.8 Flash, then Flash Lite, then MAI-Voice, then OpenAI)",
    value: DEFAULT_AUDIO_MODEL_VALUE,
  },
  { label: "Gemini 3.8 Flash TTS", value: speechModels.geminiFlash },
  { label: "Gemini 3.8 Flash Lite TTS", value: speechModels.geminiFlashLite },
  { label: "MAI-Voice-2.1 Flash (Harper voice)", value: speechModels.maiVoiceFlash },
  { label: "GPT-Realtime-2.1 mini (Marin voice)", value: speechModels.openaiRealtimeMini },
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
 * generation task exercises its automatic order.
 */
export function getSpeechModel(value: AudioModelValue): SpeechModelName | undefined {
  return value === DEFAULT_AUDIO_MODEL_VALUE ? undefined : value;
}
