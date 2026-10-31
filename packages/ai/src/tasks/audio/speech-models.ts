import {
  getBaseLanguage,
  getMaiVoiceLocale,
  isFlashLiteTTSLanguage,
  isTTSSupportedLanguage,
} from "@zoonk/utils/languages";

/**
 * The order from the `language-audio` eval (39 clips in 13 languages, 11 Oct 2026): Gemini 3.8
 * Flash read 36 right at 2.4s p50, Flash Lite 37 at 2.0s, and MAI-Voice-2.1 Flash 30 of its 34 at
 * 0.8s. MAI-Voice is on another provider, so an outage at Google doesn't silence its languages.
 */
export const speechModels = {
  geminiFlash: "google/gemini-3.8-flash-tts",
  geminiFlashLite: "google/gemini-3.8-flash-lite-tts",
  maiVoiceFlash: "microsoft/mai-voice-2.1-flash",
} as const;

export type SpeechModelName = (typeof speechModels)[keyof typeof speechModels];

const speechModelNames: readonly string[] = Object.values(speechModels);

export function isSpeechModelName(value: string): value is SpeechModelName {
  return speechModelNames.includes(value);
}

const SPEAKS_LANGUAGE: Readonly<Record<SpeechModelName, (language: string) => boolean>> = {
  [speechModels.geminiFlash]: (language) => isTTSSupportedLanguage(language),
  [speechModels.geminiFlashLite]: (language) => isFlashLiteTTSLanguage(language),
  [speechModels.maiVoiceFlash]: (language) => getMaiVoiceLocale(getBaseLanguage(language)) !== null,
};

/** A language only one model speaks gets it twice, since transport retries can't see silent audio. */
export function getSpeakingModels({
  candidates,
  language,
}: {
  candidates: readonly SpeechModelName[];
  language: string;
}): readonly SpeechModelName[] {
  const speaking = candidates.filter((model) => SPEAKS_LANGUAGE[model](language));
  return speaking.length === 1 ? [...speaking, ...speaking] : speaking;
}
