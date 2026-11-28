import { type TTSVoice, getBaseLanguage } from "@zoonk/utils/languages";
import { getPromptVersion } from "@zoonk/utils/prompt-version";
import { getPromptLanguageName } from "../_utils/prompt-language";
import { type SpeechModelName, speechModels } from "./speech-models";
import { getSpeechRequest } from "./speech-request";

/** One voice for every clip, so a word sounds the same in every lesson and screen. */
export const DEFAULT_LANGUAGE_AUDIO_VOICE: TTSVoice = "Kore";

const READ_ALOUD_TEMPLATE =
  "The following text is {{LANGUAGE}}. Speak clearly at a moderate pace suitable for language learners. Enunciate each word precisely; read it aloud in {{LANGUAGE}}.";

const NATIVE_SOUNDS_TEMPLATE =
  'Some words may look like English words but they are {{LANGUAGE}} words and must be pronounced according to {{LANGUAGE}} phonology. For example, "fruit" in Dutch is pronounced "frœyt", not the English "froot."';

const WORD_IPA_TEMPLATE =
  "The text is the {{LANGUAGE}} word, not the English word spelled the same. Pronounce it /{{IPA}}/.";

/**
 * Without it, a phrase left open on purpose ("vivo in") came out finished ("vivo in ca"): 7 of 21
 * open phrases before, 0 of 21 after, and ordinary words and sentences unchanged (Nov 2026).
 * Appending a full stop to the text instead still added speech to 2 of 21.
 */
const SAY_ONLY_THE_TEXT =
  "Say only the given text, exactly once. It may be an unfinished phrase that ends mid-sentence: stop right after its last word and add nothing (no other word, syllable, laugh or sound).";

function fillLanguage(template: string, languageName: string): string {
  return template.replaceAll("{{LANGUAGE}}", () => languageName);
}

/**
 * Names the language even for English: text-to-speech otherwise guesses it, and a short or
 * borrowed-word sentence can come out with another language's sounds. Kept apart from the task's
 * Markdown prompts so tests can replace it alone. The version covers only what `model` is sent.
 */
export function getLanguageAudioPrompt({
  ipa,
  language,
  model = speechModels.geminiFlash,
  usagePrompt = "",
  voice = DEFAULT_LANGUAGE_AUDIO_VOICE,
}: {
  /** For a single word English spells the same. */
  ipa?: string;
  language: string;
  model?: SpeechModelName;
  usagePrompt?: string;
  voice?: TTSVoice;
}): { instructions: string; promptVersion: string } {
  const languageName = getPromptLanguageName({ language });
  const isEnglish = getBaseLanguage(language) === "en";

  const instructions = [
    isEnglish ? "" : fillLanguage(NATIVE_SOUNDS_TEMPLATE, languageName),
    usagePrompt,
    fillLanguage(READ_ALOUD_TEMPLATE, languageName),
    ipa ? fillLanguage(WORD_IPA_TEMPLATE, languageName).replace("{{IPA}}", () => ipa) : "",
    SAY_ONLY_THE_TEXT,
  ]
    .filter(Boolean)
    .join("\n\n");

  const sent = getSpeechRequest({ instructions, language, model, voice });

  return {
    instructions,
    promptVersion: getPromptVersion({ systemPrompt: `${sent.voice}\n${sent.instructions ?? ""}` }),
  };
}
