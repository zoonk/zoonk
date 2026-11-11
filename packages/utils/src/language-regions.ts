import { getLanguageFlagCode } from "./language-flags";
import { toCanonicalLanguage } from "./languages";

/**
 * The countries where each language is a main language, as ISO 3166-1 alpha-2 codes. A learner's
 * language goal can name any of them; lessons teach the one its flag shows (`getTaughtRegion`).
 */
const LANGUAGE_REGIONS = {
  de: ["AT", "CH", "DE", "LI", "LU"],
  en: ["AU", "CA", "GB", "IE", "IN", "JM", "NG", "NZ", "PH", "SG", "US", "ZA"],
  es: [
    "AR",
    "BO",
    "CL",
    "CO",
    "CR",
    "CU",
    "DO",
    "EC",
    "ES",
    "GQ",
    "GT",
    "HN",
    "MX",
    "NI",
    "PA",
    "PE",
    "PR",
    "PY",
    "SV",
    "UY",
    "VE",
  ],
  fr: ["BE", "CA", "CD", "CH", "CI", "CM", "FR", "HT", "LU", "MC", "SN"],
  pt: ["AO", "BR", "CV", "GW", "MZ", "PT", "ST", "TL"],
} as const satisfies Record<string, readonly string[]>;

export type LanguageRegion = (typeof LANGUAGE_REGIONS)[keyof typeof LANGUAGE_REGIONS][number];

export type RegionChoice = {
  code: string;
  /** In the learner's language, as CLDR names it. */
  name: string;
  /** The country whose variety lessons and their audio teach. */
  taught: boolean;
};

function isRegionLanguage(language: string): language is keyof typeof LANGUAGE_REGIONS {
  return Object.hasOwn(LANGUAGE_REGIONS, language);
}

function capitalize(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Empty for a language without countries to pick from, or a tag that isn't a bare language. */
function getLanguageRegions(language: string): readonly LanguageRegion[] {
  return isRegionLanguage(language) ? LANGUAGE_REGIONS[language] : [];
}

function findLanguageRegion({
  language,
  region,
}: {
  language: string;
  region: string | undefined;
}): LanguageRegion | null {
  return getLanguageRegions(language).find((code) => code === region) ?? null;
}

export function isLanguageRegion(params: { language: string; region: string }): boolean {
  return findLanguageRegion(params) !== null;
}

export function getTaughtRegion(language: string): LanguageRegion | null {
  return findLanguageRegion({ language, region: getLanguageFlagCode(language)?.toUpperCase() });
}

/**
 * Reads the tag as written, never through `minimize()`, which reads `es` as Spain's Spanish. A
 * language with countries keeps its bare code, so every learner of it shares lessons, and the
 * country moves to `targetRegion` when it's one of the language's; other tags keep their variety.
 */
export function splitTargetLanguage(tag: string): {
  targetLanguage: string;
  targetRegion: LanguageRegion | null;
} {
  const { language, region, script } = new Intl.Locale(tag);

  if (!isRegionLanguage(language) || (script && script !== "Latn")) {
    return { targetLanguage: toCanonicalLanguage(tag), targetRegion: null };
  }

  return { targetLanguage: language, targetRegion: findLanguageRegion({ language, region }) };
}

/** Sorted by name in the learner's language. */
export function getRegionChoices({
  language,
  userLanguage,
}: {
  language: string;
  userLanguage: string;
}): RegionChoice[] {
  const names = new Intl.DisplayNames([userLanguage], { type: "region" });
  const collator = new Intl.Collator(userLanguage);
  const taught = getTaughtRegion(language);

  return getLanguageRegions(language)
    .map((code) => ({ code, name: names.of(code) ?? code, taught: code === taught }))
    .toSorted((a, b) => collator.compare(a.name, b.name));
}

type Variety = { language: string; region?: string | null; userLanguage: string };

/**
 * As it reads inside a sentence, which many languages write in lowercase: "espanhol (Argentina)" in
 * Portuguese, "Spanish (Argentina)" in English.
 */
export function getVarietyNameInSentence({ language, region, userLanguage }: Variety): string {
  const names = new Intl.DisplayNames([userLanguage], {
    languageDisplay: "standard",
    type: "language",
  });

  return names.of(region ? `${language}-${region}` : language) ?? language;
}

/**
 * "Spanish (Argentina)" with a country, "Spanish" without, in the learner's language: named from
 * the language and the country, never from the flag, so no country is shown that wasn't chosen.
 */
export function getVarietyName(variety: Variety): string {
  return capitalize(getVarietyNameInSentence(variety));
}

/** A `flag-icons` code: the country's flag when the learner chose one, else the language's. */
export function getVarietyFlagCode({
  language,
  region,
}: {
  language: string;
  region?: string | null;
}): string | null {
  return region && isLanguageRegion({ language, region })
    ? region.toLowerCase()
    : getLanguageFlagCode(language);
}
