import { type AiCourseHref } from "@/data/courses/course-href";
import { type CompletedLanguageCourseHrefs } from "@/data/courses/language-course";
import {
  type TTSSupportedLanguageCode,
  TTS_SUPPORTED_LANGUAGE_CODES,
  getLanguageName,
} from "@zoonk/utils/languages";
import { type SupportedLocale, isValidLocale } from "@zoonk/utils/locale";
import { normalizeString } from "@zoonk/utils/string";

const DEFAULT_LANGUAGE_REGIONS: Readonly<Record<string, string>> = {
  de: "DE",
  en: "US",
  fr: "FR",
  pt: "BR",
};

const REGIONAL_INDICATOR_SYMBOL_OFFSET = 127_397;

const POPULAR_LANGUAGE_CODES_BY_LOCALE = {
  de: ["en", "es", "fr", "it", "pt", "ja", "ko", "zh"],
  en: ["es", "fr", "ja", "de", "ko", "it", "zh", "pt"],
  es: ["en", "pt", "fr", "it", "ja", "de", "ko", "zh"],
  fr: ["en", "es", "de", "it", "pt", "ja", "ko", "zh"],
  pt: ["en", "es", "fr", "it", "ja", "de", "ko", "zh"],
} as const satisfies Record<SupportedLocale, readonly TTSSupportedLanguageCode[]>;

export type LanguageOption = {
  code: TTSSupportedLanguageCode;
  flag: string;
  href: `/start/speak/${TTSSupportedLanguageCode}` | AiCourseHref;
  name: string;
  nativeName: string;
  prefetch: boolean;
  rel?: "nofollow";
  searchText: string;
};

function countryCodeToFlag(code: string): string | null {
  const countryCode = code.toUpperCase();

  if (!/^[A-Z]{2}$/u.test(countryCode)) {
    return null;
  }

  return countryCode.replaceAll(/[A-Z]/gu, (char) =>
    String.fromCodePoint(REGIONAL_INDICATOR_SYMBOL_OFFSET + (char.codePointAt(0) ?? 0)),
  );
}

function localeToFlag(locale: string): string | null {
  try {
    const parsed = new Intl.Locale(locale);

    const region =
      parsed.region ?? DEFAULT_LANGUAGE_REGIONS[parsed.language] ?? parsed.maximize().region;

    return region ? countryCodeToFlag(region) : null;
  } catch {
    return null;
  }
}

function getLanguageFlag(code: TTSSupportedLanguageCode): string {
  const flag = localeToFlag(code);

  if (!flag) {
    throw new Error(`Missing flag for language code: ${code}`);
  }

  return flag;
}

function getPopularLanguageRanks(locale: string): Map<TTSSupportedLanguageCode, number> {
  const sourceLocale = isValidLocale(locale) ? locale : "en";

  return new Map(
    POPULAR_LANGUAGE_CODES_BY_LOCALE[sourceLocale].map((code, index) => [code, index]),
  );
}

/**
 * Keeps navigation rules next to the language option builder so every row has a
 * single source of truth for its href, prefetch behavior, and crawl hint. Known
 * completed courses should behave like normal catalog links, while ungenerated
 * languages still point at the generation route without prefetching that GET.
 */
function getLanguageOptionNavigation({
  code,
  completedLanguageCourseHrefs,
}: {
  code: TTSSupportedLanguageCode;
  completedLanguageCourseHrefs: CompletedLanguageCourseHrefs;
}): Pick<LanguageOption, "href" | "prefetch" | "rel"> {
  const completedCourseHref = completedLanguageCourseHrefs[code];

  if (completedCourseHref) {
    return { href: completedCourseHref, prefetch: true };
  }

  return { href: `/start/speak/${code}` as const, prefetch: false, rel: "nofollow" };
}

/**
 * Builds the language picker from the canonical TTS support list so the UI
 * cannot drift from the audio generation capability it is promising. The
 * current app language is excluded because a course where the source and
 * target language are identical does not teach a new language.
 */
export function getLanguageOptions({
  completedLanguageCourseHrefs = {},
  locale,
}: {
  completedLanguageCourseHrefs?: CompletedLanguageCourseHrefs;
  locale: string;
}): LanguageOption[] {
  const popularLanguageRanks = getPopularLanguageRanks(locale);

  return TTS_SUPPORTED_LANGUAGE_CODES.filter((code) => code !== locale)
    .map((code) => {
      const name = getLanguageName({ targetLanguage: code, userLanguage: locale });
      const nativeName = getLanguageName({ targetLanguage: code });
      const navigation = getLanguageOptionNavigation({ code, completedLanguageCourseHrefs });

      return {
        code,
        flag: getLanguageFlag(code),
        href: navigation.href,
        name,
        nativeName,
        prefetch: navigation.prefetch,
        rel: navigation.rel,
        searchText: normalizeString([code, name, nativeName].join(" ")),
      };
    })
    .toSorted((first, second) => {
      const firstPopularRank = popularLanguageRanks.get(first.code);
      const secondPopularRank = popularLanguageRanks.get(second.code);

      if (firstPopularRank !== undefined || secondPopularRank !== undefined) {
        return (
          (firstPopularRank ?? Number.POSITIVE_INFINITY) -
          (secondPopularRank ?? Number.POSITIVE_INFINITY)
        );
      }

      return first.name.localeCompare(second.name, locale);
    });
}
