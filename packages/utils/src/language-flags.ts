import { getBaseLanguage } from "./languages";

/**
 * The flag a language course shows, keyed by the ISO 639-1 code of the language it teaches. Each
 * language gets the country whose variety courses teach: US English, Brazilian Portuguese and
 * Spain Spanish, then the country most learners picture for the rest. Languages of a region use
 * its flag (Catalan, Basque, Galician, Welsh) and Arabic uses the Arab League's, since courses
 * teach Modern Standard Arabic. Codes are `flag-icons` file names.
 */
const LANGUAGE_FLAGS = {
  af: "za",
  am: "et",
  ar: "arab",
  az: "az",
  be: "by",
  bg: "bg",
  bn: "bd",
  bs: "ba",
  ca: "es-ct",
  cs: "cz",
  cy: "gb-wls",
  da: "dk",
  de: "de",
  el: "gr",
  en: "us",
  es: "es",
  et: "ee",
  eu: "es-pv",
  fa: "ir",
  fi: "fi",
  fil: "ph",
  fr: "fr",
  ga: "ie",
  gl: "es-ga",
  gu: "in",
  he: "il",
  hi: "in",
  hr: "hr",
  hu: "hu",
  hy: "am",
  id: "id",
  is: "is",
  it: "it",
  ja: "jp",
  jv: "id",
  ka: "ge",
  kk: "kz",
  km: "kh",
  kn: "in",
  ko: "kr",
  lo: "la",
  lt: "lt",
  lv: "lv",
  mg: "mg",
  mi: "nz",
  mk: "mk",
  ml: "in",
  mn: "mn",
  mr: "in",
  ms: "my",
  my: "mm",
  nb: "no",
  ne: "np",
  nl: "nl",
  no: "no",
  or: "in",
  pa: "in",
  pl: "pl",
  ps: "af",
  pt: "br",
  ro: "ro",
  ru: "ru",
  sd: "pk",
  si: "lk",
  sk: "sk",
  sl: "si",
  sq: "al",
  sr: "rs",
  sv: "se",
  sw: "tz",
  ta: "in",
  te: "in",
  th: "th",
  tl: "ph",
  tr: "tr",
  uk: "ua",
  ur: "pk",
  uz: "uz",
  vi: "vn",
  zh: "cn",
  zu: "za",
} as const satisfies Record<string, string>;

export type LanguageFlagCode = (typeof LANGUAGE_FLAGS)[keyof typeof LANGUAGE_FLAGS];

/** Country flags are two letters; region flags ("es-ct") and "arab" have no country to name. */
const COUNTRY_CODE = /^[a-z]{2}$/u;

function isFlagLanguage(language: string): language is keyof typeof LANGUAGE_FLAGS {
  return Object.hasOwn(LANGUAGE_FLAGS, language);
}

/** The flag of a language course's language ("en" and "en-US" both show the US flag), or null. */
export function getLanguageFlagCode(language: string): LanguageFlagCode | null {
  const base = getBaseLanguage(language);
  return isFlagLanguage(base) ? LANGUAGE_FLAGS[base] : null;
}

/**
 * What a flag stands for, in the viewer's language: the variety it marks ("American English",
 * "português do Brasil") or the language alone when its flag isn't a country's. Null without a
 * flag.
 */
export function getLanguageFlagLabel({
  language,
  userLanguage,
}: {
  language: string;
  userLanguage: string;
}): string | null {
  const flag = getLanguageFlagCode(language);

  if (!flag) {
    return null;
  }

  const base = getBaseLanguage(language);
  const tag = COUNTRY_CODE.test(flag) ? `${base}-${flag.toUpperCase()}` : base;
  const name = new Intl.DisplayNames([userLanguage], { type: "language" }).of(tag) ?? base;

  return name.charAt(0).toUpperCase() + name.slice(1);
}
