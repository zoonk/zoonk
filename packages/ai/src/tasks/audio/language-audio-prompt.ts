import { type TTSVoice, getBaseLanguage } from "@zoonk/utils/languages";
import { getPromptVersion } from "@zoonk/utils/prompt-version";
import { getPromptLanguageName } from "../_utils/prompt-language";

/** One voice for every clip, so a word sounds the same in every lesson and screen. */
export const DEFAULT_LANGUAGE_AUDIO_VOICE: TTSVoice = "Kore";

const READ_ALOUD_TEMPLATE =
  "The following text is {{LANGUAGE}}. Speak clearly at a moderate pace suitable for language learners. Enunciate each word precisely; read it aloud in {{LANGUAGE}}.";

const NATIVE_SOUNDS_TEMPLATE =
  'Some words may look like English words but they are {{LANGUAGE}} words and must be pronounced according to {{LANGUAGE}} phonology. For example, "fruit" in Dutch is pronounced "frœyt", not the English "froot."';

function fillLanguage(template: string, languageName: string): string {
  return template.replaceAll("{{LANGUAGE}}", () => languageName);
}

/**
 * The instructions a clip is read with, which name its language for every language, English
 * included: text-to-speech otherwise guesses the language from the text, and a short or
 * borrowed-word sentence can come out with another language's sounds. Other languages also get
 * the reminder that look-alike words keep their own sounds. A usage prompt, such as an alphabet
 * card's, goes between the two.
 *
 * It lives apart from the task, without its Markdown prompts, so code that only needs a clip's
 * prompt version (the speech clip cache key, and the tests that seed it) can compute it.
 */
export function getLanguageAudioPrompt({
  language,
  usagePrompt = "",
  voice = DEFAULT_LANGUAGE_AUDIO_VOICE,
}: {
  language: string;
  usagePrompt?: string;
  voice?: TTSVoice;
}): { instructions: string; promptVersion: string } {
  const languageName = getPromptLanguageName({ language });
  const isEnglish = getBaseLanguage(language) === "en";

  const instructions = [
    isEnglish ? "" : fillLanguage(NATIVE_SOUNDS_TEMPLATE, languageName),
    usagePrompt,
    fillLanguage(READ_ALOUD_TEMPLATE, languageName),
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    instructions,
    promptVersion: getPromptVersion({ systemPrompt: `${voice}\n${instructions}` }),
  };
}
