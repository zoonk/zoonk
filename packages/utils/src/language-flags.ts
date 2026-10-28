import { getBaseLanguage } from "./languages";

/**
 * Each language shows the country whose variety courses teach, and Arabic the Arab League's since
 * courses teach Modern Standard Arabic. Codes are `flag-icons` file names.
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

const COUNTRY_CODE = /^[a-z]{2}$/u;

function isFlagLanguage(language: string): language is keyof typeof LANGUAGE_FLAGS {
  return Object.hasOwn(LANGUAGE_FLAGS, language);
}

export function getLanguageFlagCode(language: string): LanguageFlagCode | null {
  const base = getBaseLanguage(language);
  return isFlagLanguage(base) ? LANGUAGE_FLAGS[base] : null;
}

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
