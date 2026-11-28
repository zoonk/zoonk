import { type TTSVoice, getBaseLanguage, getMaiVoiceLocale } from "@zoonk/utils/languages";
import { type SpeechModelName, speechModels } from "./speech-models";

/** MAI-Voice's Harper speaks every one of its languages, so every clip sounds like the same speaker. */
const MAI_VOICE_SPEAKER = "Harper";

function getMaiVoice(language: string): string {
  const locale = getMaiVoiceLocale(getBaseLanguage(language));

  if (!locale) {
    throw new Error(`MAI-Voice doesn't speak ${language}`);
  }

  return `${locale}-${MAI_VOICE_SPEAKER}`;
}

/**
 * What a model is sent. MAI-Voice takes no instructions (only SSML styles, which the gateway
 * drops), so its voice names the language.
 */
export function getSpeechRequest({
  instructions,
  language,
  model,
  voice,
}: {
  instructions: string;
  language: string;
  model: SpeechModelName;
  voice: TTSVoice;
}): { instructions?: string; voice: string } {
  if (model === speechModels.maiVoiceFlash) {
    return { voice: getMaiVoice(language) };
  }

  return { instructions, voice };
}
