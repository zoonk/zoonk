import { getBaseLanguage, getLanguageName } from "@zoonk/utils/languages";
import { getPromptVersion } from "@zoonk/utils/prompt-version";

const SPEAKER_TEMPLATE =
  "The following text is one person's lines in a recording in {{LANGUAGE}} for a listening exam. Speak with a clear, unmistakable {{ACCENT}} accent throughout: its vowels, consonants and intonation, as a native speaker of that variety. Say it as that person talking, not reading, at the calm, unhurried pace of a real exam recording, a little slower than everyday conversation, with a short pause between sentences. Say only the words given, nothing else.";

/** Every line's instructions share this text; only the accent changes between speakers. */
const PROMPT_VERSION_TEXT = SPEAKER_TEMPLATE;

/**
 * Asked for an exam recording's natural pace, Flash Lite read up to 207 words a minute; "calm,
 * unhurried, a little slower than everyday conversation" read 150 to 185, real exams' range (10
 * Oct 2026).
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

export function getListeningVoicePromptVersion(): string {
  return getPromptVersion({ systemPrompt: PROMPT_VERSION_TEXT });
}
