/**
 * Gemini 3.8 Flash TTS's languages in https://ai.google.dev/gemini-api/docs/speech-generation (28
 * Oct 2026), as our canonical tags. Irish, Malagasy, Ukrainian and Urdu aren't in its table, but
 * Flash still reads them right (checked 30 Oct 2026).
 */
const TTS_SUPPORTED_LANGUAGE_CODES = [
  "ace",
  "af",
  "ak",
  "am",
  "ar",
  "arz",
  "as",
  "awa",
  "az",
  "azb",
  "ba",
  "ban",
  "be",
  "bem",
  "bg",
  "bho",
  "bjn",
  "bn",
  "bs",
  "bug",
  "ca",
  "ceb",
  "ckb",
  "crh",
  "cs",
  "da",
  "de",
  "dyu",
  "dz",
  "el",
  "en",
  "es",
  "et",
  "eu",
  "fa",
  "ff",
  "fi",
  "fil",
  "fr",
  "fuv",
  "ga",
  "gl",
  "gn",
  "gu",
  "ha",
  "he",
  "hi",
  "hne",
  "hr",
  "ht",
  "hu",
  "hy",
  "id",
  "ig",
  "ilo",
  "is",
  "it",
  "ja",
  "jv",
  "ka",
  "kab",
  "kam",
  "kg",
  "ki",
  "kk",
  "km",
  "kn",
  "ko",
  "ks",
  "ky",
  "lb",
  "lg",
  "ln",
  "lo",
  "lt",
  "ltg",
  "lus",
  "lv",
  "mag",
  "mai",
  "mg",
  "min",
  "mk",
  "ml",
  "mn",
  "mni",
  "mr",
  "ms",
  "mt",
  "my",
  "nb",
  "ne",
  "nl",
  "nn",
  "no",
  "nso",
  "ny",
  "oc",
  "or",
  "pa",
  "pag",
  "pbt",
  "pl",
  "ps",
  "pt",
  "ro",
  "ru",
  "rw",
  "sat",
  "sd",
  "si",
  "sk",
  "sl",
  "so",
  "sq",
  "sr",
  "ss",
  "st",
  "sv",
  "sw",
  "ta",
  "te",
  "tg",
  "th",
  "ti",
  "tr",
  "ug",
  "uk",
  "ur",
  "uz",
  "vi",
  "yue",
  "zh",
] as const;

/** Languages Gemini 3.8 Flash-Lite TTS doesn't speak, by the same table. */
const FLASH_LITE_TTS_UNSUPPORTED_CODES: ReadonlySet<string> = new Set([
  "ba",
  "bem",
  "bjn",
  "crh",
  "dyu",
  "dz",
  "fi",
  "ga",
  "gn",
  "ig",
  "kab",
  "lb",
  "lt",
  "ltg",
  "mg",
  "min",
  "my",
  "oc",
  "pag",
  "sd",
  "sl",
  "so",
  "sq",
  "ss",
  "st",
  "sv",
  "sw",
  "tg",
  "th",
  "ti",
  "ug",
  "uk",
  "ur",
]);

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
  nb: "nb-NO",
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

export function isTTSSupportedLanguage(language: string): boolean {
  return TTS_SUPPORTED_LANGUAGE_SET.has(getBaseLanguage(language));
}

export function isFlashLiteTTSLanguage(language: string): boolean {
  return (
    isTTSSupportedLanguage(language) &&
    !FLASH_LITE_TTS_UNSUPPORTED_CODES.has(getBaseLanguage(language))
  );
}

/** Without `userLanguage`, returns the native name ("Español", "日本語"). */
export function getLanguageName(params: { targetLanguage: string; userLanguage?: string }): string {
  const locale = params.userLanguage ?? params.targetLanguage;
  const displayNames = new Intl.DisplayNames([locale], { type: "language" });
  const name = displayNames.of(params.targetLanguage) ?? params.targetLanguage;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** `Intl` reads every code this matches; a made-up or underscored one ("pt_BR") would throw. */
export const LANGUAGE_CODE_PATTERN = /^[a-zA-Z]{2,3}(?:-[a-zA-Z]{4})?(?:-(?:[a-zA-Z]{2}|\d{3}))?$/u;

/** Tags for the same language and variety become one, so they share courses: `cmn`, `zh-CN` and `zh-Hans` are `zh`. */
export function toCanonicalLanguage(language: string): string {
  return new Intl.Locale(language).minimize().toString();
}

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

/** Reads the script from the tag, or the one the language is usually written in. */
export function usesNonLatinScript(language: string): boolean {
  const { script } = new Intl.Locale(language).maximize();
  return script !== undefined && script !== "Latn";
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
