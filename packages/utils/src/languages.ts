/**
 * ISO 639-1 codes for languages supported by Gemini TTS (gemini-2.5-flash-preview-tts).
 * Source: https://ai.google.dev/gemini-api/docs/speech-generation
 *
 * Some Gemini codes differ from ISO 639-1 (e.g., `cmn` for Mandarin, `fil` for Filipino,
 * `nb`/`nn` for Norwegian). We use standard ISO 639-1 codes here (`zh`, `tl`, `no`)
 * since that's what the rest of our app uses. Gemini auto-detects language from
 * text, so the exact code doesn't need to match their internal identifiers.
 */
const TTS_SUPPORTED_LANGUAGE_CODES = [
  "af",
  "am",
  "ar",
  "az",
  "be",
  "bg",
  "bn",
  "ca",
  "cs",
  "da",
  "de",
  "el",
  "en",
  "es",
  "et",
  "eu",
  "fa",
  "fi",
  "fr",
  "ga",
  "gu",
  "hi",
  "hr",
  "hu",
  "hy",
  "id",
  "is",
  "it",
  "ja",
  "jv",
  "ka",
  "kn",
  "ko",
  "lo",
  "lv",
  "lt",
  "mk",
  "mg",
  "ml",
  "mn",
  "mr",
  "ms",
  "my",
  "ne",
  "nl",
  "no",
  "or",
  "pa",
  "pl",
  "ps",
  "pt",
  "ro",
  "ru",
  "sd",
  "si",
  "sk",
  "sl",
  "sq",
  "sr",
  "sv",
  "sw",
  "ta",
  "te",
  "th",
  "tl",
  "tr",
  "uk",
  "ur",
  "vi",
  "zh",
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
 * Used to decide whether romanized text should be generated alongside native script.
 */
const NON_ROMAN_SCRIPT_LANGUAGES = new Set([
  "am",
  "ar",
  "be",
  "bg",
  "bn",
  "bo",
  "dv",
  "el",
  "fa",
  "gu",
  "he",
  "hi",
  "hy",
  "ja",
  "ka",
  "km",
  "kn",
  "ko",
  "lo",
  "mk",
  "ml",
  "mn",
  "mr",
  "my",
  "ne",
  "pa",
  "ps",
  "ru",
  "sd",
  "si",
  "sr",
  "ta",
  "te",
  "th",
  "ti",
  "uk",
  "ur",
  "yi",
  "zh",
]);

/**
 * Returns true for languages whose primary writing system is non-Roman.
 * Learners need Latin-script transliteration for these languages until they can read the native script.
 */
export function needsRomanization(languageCode: string): boolean {
  return NON_ROMAN_SCRIPT_LANGUAGES.has(languageCode);
}

export const TTS_VOICES = [
  "Achernar",
  "Achird",
  "Algenib",
  "Algieba",
  "Alnilam",
  "Aoede",
  "Autonoe",
  "Callirrhoe",
  "Charon",
  "Despina",
  "Enceladus",
  "Erinome",
  "Fenrir",
  "Gacrux",
  "Iapetus",
  "Kore",
  "Laomedeia",
  "Leda",
  "Orus",
  "Puck",
  "Pulcherrima",
  "Rasalgethi",
  "Sadachbia",
  "Sadaltager",
  "Schedar",
  "Sulafat",
  "Umbriel",
  "Vindemiatrix",
  "Zephyr",
  "Zubenelgenubi",
] as const;

export type TTSVoice = (typeof TTS_VOICES)[number];
