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
] as const;

export type AudioModelValue = (typeof AUDIO_MODEL_OPTIONS)[number]["value"];

export function isAudioModelValue(value: string): value is AudioModelValue {
  return value === DEFAULT_AUDIO_MODEL_VALUE || isSpeechModelName(value);
}

export function getSpeechModel(value: AudioModelValue): SpeechModelName | undefined {
  return value === DEFAULT_AUDIO_MODEL_VALUE ? undefined : value;
}
