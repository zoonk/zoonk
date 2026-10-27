/**
 * ISO 639-1 codes for languages supported by Gemini TTS (gemini-3.8-flash-tts and its Lite model).
 * Source: https://ai.google.dev/gemini-api/docs/speech-generation
 *
 * Some Gemini codes differ from ISO 639-1 (e.g., `cmn` for Mandarin, `fil` for Filipino,
 * `nb`/`nn` for Norwegian). We use standard ISO 639-1 codes here (`zh`, `tl`, `no`)
 * since that's what the rest of our app uses. Gemini auto-detects language from
 * text, so the exact code doesn't need to match their internal identifiers.
 */
export const TTS_SUPPORTED_LANGUAGE_CODES = [
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

/**
 * The locale MAI-Voice speaks each of its 23 languages in, by ISO 639-1 code (Microsoft Learn,
 * "MAI-Voice-2.1 and MAI-Voice-2.1-Flash", checked 11 Oct 2026). Portuguese and Spanish are
 * Brazilian and Mexican, the regions its every-language voice speaks.
 */
const MAI_VOICE_LOCALES: Readonly<Record<string, string>> = {
  cs: "cs-CZ",
  da: "da-DK",
  de: "de-DE",
  en: "en-US",
  es: "es-MX",
  fi: "fi-FI",
  fr: "fr-FR",
  hi: "hi-IN",
  hu: "hu-HU",
  id: "id-ID",
  it: "it-IT",
  ko: "ko-KR",
  nl: "nl-NL",
  no: "nb-NO",
  pl: "pl-PL",
  pt: "pt-BR",
  ro: "ro-RO",
  ru: "ru-RU",
  sv: "sv-SE",
  th: "th-TH",
  tr: "tr-TR",
  vi: "vi-VN",
  zh: "zh-CN",
};

/** The locale MAI-Voice speaks a language in ("pt-BR" for "pt"), or null when it doesn't. */
export function getMaiVoiceLocale(code: string): string | null {
  return MAI_VOICE_LOCALES[code] ?? null;
}

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
 * ISO 639-1 codes for languages whose primary writing system isn't the Latin one. Learners have to
 * learn the script before reading them, so their courses start with the alphabet and their text
 * gets a romanized version ("konnichiwa" next to "こんにちは").
 */
const NON_LATIN_SCRIPT_LANGUAGES = new Set([
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

/** The language of a tag without its region: "pt" for "pt-BR" or "PT_br". */
export function getBaseLanguage(language: string): string {
  return language.toLowerCase().split(/[-_]/u)[0] ?? "";
}

/**
 * Whether the learner reads the app in the language they're learning, such as an IELTS candidate
 * reading it in English: nothing can be translated, so a word's meaning is a definition.
 */
export function isSameLanguage({
  learnerLanguage,
  targetLanguage,
}: {
  learnerLanguage: string;
  targetLanguage: string;
}): boolean {
  return getBaseLanguage(learnerLanguage) === getBaseLanguage(targetLanguage);
}

/** Whether a language (an ISO code like "ja" or "pt-BR") uses a script other than the Latin one. */
export function usesNonLatinScript(language: string): boolean {
  return NON_LATIN_SCRIPT_LANGUAGES.has(getBaseLanguage(language));
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
