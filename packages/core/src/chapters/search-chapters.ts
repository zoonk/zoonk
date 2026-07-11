import "server-only";
import {
  type ChapterGetPayload,
  type Organization,
  getPublishedChapterWhere,
  prisma,
} from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { normalizeString } from "@zoonk/utils/string";
import { getSearchLanguageFilter } from "../_utils/search-language-filter";

type ChapterFindManyArgs = NonNullable<Parameters<typeof prisma.chapter.findMany>[0]>;
type ChapterSearchWhere = ChapterFindManyArgs["where"];

type ChapterSearchRow = ChapterGetPayload<{
  include: { course: { include: { organization: true } } };
}>;

type ChapterWithCourse = ChapterSearchRow & {
  course: ChapterSearchRow["course"] & { organization: Organization };
};

const DEFAULT_CHAPTER_SEARCH_LIMIT = 5;

/**
 * Command palette search treats chapters as secondary catalog results. The
 * query returns only published chapters from published brand courses, then
 * ranks exact title matches ahead of partial title and description matches.
 */
export async function searchChapters(params: {
  filterByLanguage?: boolean;
  query: string;
  language?: string;
  limit?: number;
}): Promise<ChapterWithCourse[]> {
  const limit = clampQueryItems(params.limit ?? DEFAULT_CHAPTER_SEARCH_LIMIT);
  const normalizedSearch = normalizeString(params.query);

  if (!normalizedSearch) {
    return [];
  }

  const baseWhere = getPublishedChapterWhere({
    chapterWhere: {
      ...getSearchLanguageFilter({
        filterByLanguage: params.filterByLanguage,
        language: params.language,
      }),
    },
    courseWhere: { organization: { kind: "brand" } as const },
  });

  const [exactTitleMatches, titleMatches, descriptionMatches] = await Promise.all([
    findChapterSearchMatches({ limit, where: { ...baseWhere, normalizedTitle: normalizedSearch } }),
    findChapterSearchMatches({
      limit,
      where: { ...baseWhere, normalizedTitle: { contains: normalizedSearch, mode: "insensitive" } },
    }),
    findChapterSearchMatches({
      limit,
      where: {
        ...baseWhere,
        ...getChapterDescriptionWhere({ normalizedSearch, query: params.query }),
      },
    }),
  ]);

  return mergeChapterResults({
    descriptionMatches: descriptionMatches.filter((chapter) =>
      hasChapterCourseOrganization(chapter),
    ),
    exactTitleMatches: exactTitleMatches.filter((chapter) => hasChapterCourseOrganization(chapter)),
    language: params.language,
    limit,
    titleMatches: titleMatches.filter((chapter) => hasChapterCourseOrganization(chapter)),
  });
}

/**
 * Chapter search always needs parent course and brand data to build catalog
 * URLs. Centralizing that include keeps the title and description match queries
 * from drifting as the command palette result shape changes.
 */
async function findChapterSearchMatches({
  limit,
  where,
}: {
  limit: number;
  where: ChapterSearchWhere;
}): Promise<ChapterSearchRow[]> {
  const chapters = await prisma.chapter.findMany({
    include: { course: { include: { organization: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
    where,
  });

  return chapters;
}

/**
 * Chapter descriptions are not stored in normalized form, so description
 * search checks both the learner's original text and the normalized query.
 * That keeps exact typed text working while still allowing ASCII-only
 * descriptions to match the same normalized term used for titles.
 */
function getChapterDescriptionWhere({
  normalizedSearch,
  query,
}: {
  normalizedSearch: string;
  query: string;
}) {
  const searchTerms = getDescriptionSearchTerms({ normalizedSearch, query });

  return {
    OR: searchTerms.map((searchTerm) => ({
      description: { contains: searchTerm, mode: "insensitive" as const },
    })),
  };
}

/**
 * Prisma cannot infer that filtering through course.organization guarantees
 * the included organization exists. This guard keeps the public return type
 * honest before the command palette builds brand-scoped links.
 */
function hasChapterCourseOrganization(chapter: ChapterSearchRow): chapter is ChapterWithCourse {
  return chapter.course.organization !== null;
}

/**
 * Search terms can collapse to the same value after normalization. Removing
 * duplicates avoids asking Prisma to evaluate the same description predicate
 * twice for common ASCII queries.
 */
function getDescriptionSearchTerms({
  normalizedSearch,
  query,
}: {
  normalizedSearch: string;
  query: string;
}) {
  return [...new Set([query.trim(), normalizedSearch].filter(Boolean))];
}

/**
 * The command palette needs chapters after courses, but chapter ranking still
 * matters inside that group: exact title matches should beat fuzzy title
 * matches, and title matches should beat description-only matches.
 */
function mergeChapterResults({
  descriptionMatches,
  exactTitleMatches,
  language,
  limit,
  titleMatches,
}: {
  descriptionMatches: ChapterWithCourse[];
  exactTitleMatches: ChapterWithCourse[];
  language?: string;
  limit: number;
  titleMatches: ChapterWithCourse[];
}) {
  const rankedResults = [
    ...sortByLanguagePreference({ items: exactTitleMatches, language }),
    ...sortByLanguagePreference({ items: titleMatches, language }),
    ...sortByLanguagePreference({ items: descriptionMatches, language }),
  ];

  return keepFirstResultPerId(rankedResults).slice(0, limit);
}

/**
 * Learners usually search in their active app language. Keeping that language
 * first within each rank mirrors course search without letting language
 * preference push description-only matches ahead of exact chapter titles.
 */
function sortByLanguagePreference<TItem extends { language: string }>({
  items,
  language,
}: {
  items: TItem[];
  language?: string;
}) {
  if (!language) {
    return items;
  }

  return items.toSorted((a, b) => {
    const aMatch = a.language === language ? 0 : 1;
    const bMatch = b.language === language ? 0 : 1;
    return aMatch - bMatch;
  });
}

/**
 * A chapter can match in more than one bucket, especially exact titles because
 * they also satisfy the contains query. Keeping the first occurrence preserves
 * the highest-ranked bucket for every chapter.
 */
function keepFirstResultPerId<TItem extends { id: string }>(items: TItem[]) {
  return items.filter(
    (item, index) => items.findIndex((result) => result.id === item.id) === index,
  );
}
