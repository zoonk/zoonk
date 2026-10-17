import { getBaseLanguage, getLanguageName } from "@zoonk/utils/languages";
import { getPromptVersion } from "@zoonk/utils/prompt-version";

const SPEAKER_TEMPLATE =
  "The following text is one person's lines in a recording in {{LANGUAGE}} for a listening exam. Speak with a clear, unmistakable {{ACCENT}} accent throughout: its vowels, consonants and intonation, as a native speaker of that variety. Say it as that person talking, not reading, at the calm, unhurried pace of a real exam recording, a little slower than everyday conversation, with a short pause between sentences. Say only the words given, nothing else.";

/** Every line's instructions share this text; only the accent changes between speakers. */
const PROMPT_VERSION_TEXT = SPEAKER_TEMPLATE;

/**
 * The instructions one speaker's lines are voiced with: the language by its plain name, since the
 * accent names its variety ("British English", "Mexican Spanish"), and a pace like the exam's own
 * recordings, not the slower one lesson clips use. Flash Lite reads ordinary speech fast: asked
 * for "the natural pace of a real exam recording" or for 150 words a minute, it read up to 207
 * words a minute; "calm, unhurried, a little slower than everyday conversation" read between 150
 * and 185 depending on the text (10 Oct 2026), the range of real exam recordings. Stronger words
 * ("slowly") didn't slow long parts further.
 */
export function getListeningVoiceInstructions({
  accent,
  language,
}: {
  accent: string;
  language: string;
}): string {
  const languageName = getLanguageName({
    targetLanguage: getBaseLanguage(language),
    userLanguage: "en",
  });

  return SPEAKER_TEMPLATE.replaceAll("{{LANGUAGE}}", () => languageName).replaceAll(
    "{{ACCENT}}",
    () => accent,
  );
}

/** The version stored with a voiced recording: it changes when the instructions do. */
export function getListeningVoicePromptVersion(): string {
  return getPromptVersion({ systemPrompt: PROMPT_VERSION_TEXT });
}
