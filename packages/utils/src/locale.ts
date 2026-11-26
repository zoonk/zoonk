export const SUPPORTED_LOCALES = [
  "en",
  "es",
  "pt",
  "fr",
  "de",
  "it",
  "ja",
  "ko",
  "tr",
  "pl",
] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";

export const LOCALE_COOKIE = "ZOONK_LOCALE";

export function isValidLocale(value: string): value is SupportedLocale {
  return SUPPORTED_LOCALES.some((locale) => locale === value);
}

function getLanguageSubtag(language: string): string | null {
  try {
    return new Intl.Locale(language).language ?? null;
  } catch {
    return null;
  }
}

/** Null for an unsupported language: a fallback would mark that content as English. */
export function getContentLocale(language: string): SupportedLocale | null {
  const locale = getLanguageSubtag(language);
  return locale && isValidLocale(locale) ? locale : null;
}

/** Plain `es` writes numbers and dates Spain's way (1.234,56), but the app's Spanish and its courses are Mexico's. */
const FORMATTING_LOCALES: ReadonlyMap<string, string> = new Map([["es", "es-MX"]]);

export function getFormattingLocale(language: string): string {
  return FORMATTING_LOCALES.get(language) ?? language;
}

/** Japanese and Chinese write sentences back to back: their full-width stops carry the space. */
const NO_SENTENCE_SPACE_SCRIPTS = new Set(["Hans", "Hant", "Jpan"]);

function writesFullWidthStops(locale: string): boolean {
  const { script } = new Intl.Locale(locale).maximize();
  return script !== undefined && NO_SENTENCE_SPACE_SCRIPTS.has(script);
}

export function getSentenceSpace(locale: string): string {
  return writesFullWidthStops(locale) ? "" : " ";
}

const SENTENCE_END = /[.!?…。！？]$/u;

/** Ends a phrase with the locale's full stop, unless it already ends a sentence. */
export function toSentence(text: string, locale: string): string {
  if (SENTENCE_END.test(text)) {
    return text;
  }

  return `${text}${writesFullWidthStops(locale) ? "。" : "."}`;
}

const STOP = /^[.!?…。！？]/u;

/**
 * Puts `text` where `slot` stands in a translated line. A text that ends a sentence itself takes
 * the place of the line's own stop right after it, so "…di fronte." never reads "…di fronte..".
 */
export function fillSlot(line: string, slot: string, text: string): string {
  const at = line.indexOf(slot);

  if (at === -1) {
    return line;
  }

  const rest = line.slice(at + slot.length);
  return `${line.slice(0, at)}${text}${SENTENCE_END.test(text) ? rest.replace(STOP, "") : rest}`;
}

export function getSupportedLocaleFromLanguage(language: string): SupportedLocale {
  return getContentLocale(language) ?? DEFAULT_LOCALE;
}

/** Native names, never translated. */
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  de: "Deutsch",
  en: "English (US)",
  es: "Español (México)",
  fr: "Français",
  it: "Italiano",
  ja: "日本語",
  ko: "한국어",
  pl: "Polski",
  pt: "Português (Brasil)",
  tr: "Türkçe",
} as const;
