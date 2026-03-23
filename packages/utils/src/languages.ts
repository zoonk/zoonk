/**
 * ISO 639-1 codes for languages supported by OpenAI TTS (gpt-4o-mini-tts).
 * Source: https://platform.openai.com/docs/guides/text-to-speech
 */
const TTS_SUPPORTED_LANGUAGE_CODES = [
  "af",
  "ar",
  "hy",
  "az",
  "be",
  "bs",
  "bg",
  "ca",
  "zh",
  "hr",
  "cs",
  "da",
  "nl",
  "en",
  "et",
  "fi",
  "fr",
  "gl",
  "de",
  "el",
  "he",
  "hi",
  "hu",
  "is",
  "id",
  "it",
  "ja",
  "kn",
  "kk",
  "ko",
  "lv",
  "lt",
  "mk",
  "ms",
  "mr",
  "mi",
  "ne",
  "no",
  "fa",
  "pl",
  "pt",
  "ro",
  "ru",
  "sr",
  "sk",
  "sl",
  "es",
  "sw",
  "sv",
  "tl",
  "ta",
  "th",
  "tr",
  "uk",
  "ur",
  "vi",
  "cy",
] as const;

const TTS_SUPPORTED_LANGUAGE_SET: ReadonlySet<string> = new Set(TTS_SUPPORTED_LANGUAGE_CODES);

export function isTTSSupportedLanguage(
  code: unknown,
): code is (typeof TTS_SUPPORTED_LANGUAGE_CODES)[number] {
  return typeof code === "string" && TTS_SUPPORTED_LANGUAGE_SET.has(code);
}

/**
 * Get localized language name from an ISO 639-1 code.
 * When `userLanguage` is omitted, returns the native name (e.g., "Español", "日本語").
 */
export function getLanguageName(params: { targetLanguage: string; userLanguage?: string }): string {
  const locale = params.userLanguage ?? params.targetLanguage;
  const displayNames = new Intl.DisplayNames([locale], { type: "language" });
  const name = displayNames.of(params.targetLanguage) ?? params.targetLanguage;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * ISO 639-1 codes for languages whose primary writing system is non-Roman.
 * Used to decide whether romanized (Latin-script) versions of text
 * should be generated alongside the native script — for example,
 * showing "konnichiwa" next to "こんにちは" to help learners
 * who can't yet read the native script.
 */
const NON_ROMAN_SCRIPT_LANGUAGES = new Set([
  "ar",
  "bg",
  "el",
  "he",
  "hi",
  "hy",
  "ja",
  "ka",
  "kn",
  "ko",
  "mk",
  "mr",
  "ne",
  "ru",
  "sr",
  "ta",
  "th",
  "uk",
  "ur",
  "zh",
]);

/**
 * Returns true for languages whose primary writing system is non-Roman.
 * This is used to decide whether we need to generate a romanized
 * (Latin-script) transliteration of content so learners who can't
 * yet read the native script can still follow along phonetically.
 */
export function needsRomanization(languageCode: string): boolean {
  return NON_ROMAN_SCRIPT_LANGUAGES.has(languageCode);
}

export const TTS_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "cedar",
  "coral",
  "echo",
  "fable",
  "marin",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
] as const;

export type TTSVoice = (typeof TTS_VOICES)[number];
