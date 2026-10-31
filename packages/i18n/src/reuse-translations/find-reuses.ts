import { type English, mapPlaceholders, parseEnglish } from "./placeholders.ts";

/** Where a missing translation looks after its own package, in this order. */
export const PACKAGES = ["main", "learn", "player", "api", "apple", "android"] as const;

export type PackageName = (typeof PACKAGES)[number];

type CatalogMessage = {
  id: string;
  english: string;
  comment: string;
  translations: Partial<Record<string, string>>;
  /** Apple's and Android's printf type per placeholder (`d`, `s`), which their ICU text drops. */
  kinds?: Partial<Record<string, string>>;
  /** Locales where someone asked Eloqnt to translate it again, so it isn't filled from elsewhere. */
  retranslate?: readonly string[];
};

export type Catalog = {
  packageName: PackageName;
  name: string;
  locales: readonly string[];
  messages: CatalogMessage[];
};

export type Reuse<CatalogType extends Catalog = Catalog> = {
  catalog: CatalogType;
  locale: string;
  id: string;
  translation: string;
};

type Occurrence<CatalogType extends Catalog> = {
  catalog: CatalogType;
  message: CatalogMessage;
  english: English;
};

const MIN_WORDS_WITHOUT_CONTEXT = 3;

function occurrencesOf<CatalogType extends Catalog>(catalogs: CatalogType[]) {
  return catalogs.flatMap((catalog) =>
    catalog.messages.flatMap((message): Occurrence<CatalogType>[] => {
      const english = message.english.trim() ? parseEnglish(message.english) : undefined;
      return english ? [{ catalog, english, message }] : [];
    }),
  );
}

function hasTranslation(message: CatalogMessage, locale: string) {
  return Boolean(message.translations[locale]?.trim());
}

/** Web placeholders carry no type, so they fit either. */
function hasSameKinds<CatalogType extends Catalog>(
  candidate: Occurrence<CatalogType>,
  target: Occurrence<CatalogType>,
) {
  return candidate.english.names.every((name, index) => {
    const candidateKind = candidate.message.kinds?.[name];
    const targetKind = target.message.kinds?.[target.english.names[index] ?? ""];
    return !candidateKind || !targetKind || candidateKind === targetKind;
  });
}

function hasSameContext<CatalogType extends Catalog>(
  candidate: Occurrence<CatalogType>,
  target: Occurrence<CatalogType>,
) {
  const { comment } = target.message;

  return (
    candidate.message.comment === comment ||
    (!comment && target.english.words >= MIN_WORDS_WITHOUT_CONTEXT)
  );
}

function findTranslation<CatalogType extends Catalog>({
  target,
  candidates,
  locale,
}: {
  target: Occurrence<CatalogType>;
  candidates: Occurrence<CatalogType>[];
  locale: string;
}) {
  const rank = (catalog: Catalog) =>
    catalog.packageName === target.catalog.packageName ? -1 : PACKAGES.indexOf(catalog.packageName);

  return candidates
    .filter(
      (candidate) =>
        hasTranslation(candidate.message, locale) &&
        hasSameKinds(candidate, target) &&
        hasSameContext(candidate, target),
    )
    .toSorted((first, second) => rank(first.catalog) - rank(second.catalog))
    .map((candidate) =>
      mapPlaceholders({
        from: candidate.english,
        to: target.english,
        translation: candidate.message.translations[locale] ?? "",
      }),
    )
    .find((translation) => translation !== undefined);
}

/**
 * Fills each of the package's missing translations with an existing translation of the same English from any catalog,
 * picked from its own package first, then in `PACKAGES` order. Plurals and selects are left out.
 *
 * A translator comment marks a message whose context matters, so a message with one reuses only a translation with that
 * same comment. One without reuses any translation when it has three or more words; a shorter label can need different
 * forms in different places, so it reuses only one without a comment either.
 */
export function findReuses<CatalogType extends Catalog>({
  catalogs,
  packageName,
}: {
  catalogs: CatalogType[];
  packageName: PackageName;
}): Reuse<CatalogType>[] {
  const occurrences = occurrencesOf(catalogs);
  const byEnglish = Map.groupBy(occurrences, (occurrence) => occurrence.english.key);

  function reuse(target: Occurrence<CatalogType>, locale: string): Reuse<CatalogType>[] {
    if (hasTranslation(target.message, locale) || target.message.retranslate?.includes(locale)) {
      return [];
    }

    const translation = findTranslation({
      candidates: byEnglish.get(target.english.key) ?? [],
      locale,
      target,
    });

    return translation === undefined
      ? []
      : [{ catalog: target.catalog, id: target.message.id, locale, translation }];
  }

  return occurrences
    .filter((occurrence) => occurrence.catalog.packageName === packageName)
    .flatMap((target) => target.catalog.locales.flatMap((locale) => reuse(target, locale)));
}
