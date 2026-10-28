/**
 * From https://ai.google.dev/gemini-api/docs/speech-generation. Gemini detects the language from
 * the text, so we keep ISO 639-1 codes (`zh`, `tl`, `no`) where Gemini's differ.
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
 * From Microsoft Learn's "MAI-Voice-2.1 and MAI-Voice-2.1-Flash". Portuguese and Spanish are
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

export function getMaiVoiceLocale(code: string): string | null {
  return MAI_VOICE_LOCALES[code] ?? null;
}

const TTS_SUPPORTED_LANGUAGE_SET: ReadonlySet<string> = new Set(TTS_SUPPORTED_LANGUAGE_CODES);

export function isTTSSupportedLanguage(
  code: unknown,
): code is (typeof TTS_SUPPORTED_LANGUAGE_CODES)[number] {
  return typeof code === "string" && TTS_SUPPORTED_LANGUAGE_SET.has(code);
}

/** Without `userLanguage`, returns the native name ("Español", "日本語"). */
export function getLanguageName(params: { targetLanguage: string; userLanguage?: string }): string {
  const locale = params.userLanguage ?? params.targetLanguage;
  const displayNames = new Intl.DisplayNames([locale], { type: "language" });
  const name = displayNames.of(params.targetLanguage) ?? params.targetLanguage;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

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

/** `Intl` reads every code this matches; a made-up or underscored one ("pt_BR") would throw. */
export const LANGUAGE_CODE_PATTERN = /^[a-zA-Z]{2,3}(?:-[a-zA-Z]{4})?(?:-(?:[a-zA-Z]{2}|\d{3}))?$/u;

export function getBaseLanguage(language: string): string {
  return language.toLowerCase().split(/[-_]/u)[0] ?? "";
}

export function isSameLanguage({
  learnerLanguage,
  targetLanguage,
}: {
  learnerLanguage: string;
  targetLanguage: string;
}): boolean {
  return getBaseLanguage(learnerLanguage) === getBaseLanguage(targetLanguage);
}

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
