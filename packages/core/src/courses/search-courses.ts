import "server-only";
import {
  type CourseGetPayload,
  type Organization,
  getPublishedCourseWhere,
  prisma,
} from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { DEFAULT_SEARCH_LIMIT } from "@zoonk/utils/search";
import { normalizeString } from "@zoonk/utils/string";
import { getSearchLanguageFilter } from "../_utils/search-language-filter";

type CourseSearchRow = CourseGetPayload<{ include: { organization: true } }>;

type CourseWithOrganization = Omit<CourseSearchRow, "organization"> & {
  organization: Organization;
};

type CourseSearchWhere = ReturnType<typeof getPublishedCourseWhere>;

type SearchCoursesParams = {
  filterByLanguage?: boolean;
  query: string;
  language?: string;
  limit?: number;
  offset?: number;
};

type CourseSearchSegment = { bucketIndex: number; skip: number; take: number };

/**
 * Narrows relation-nullable Prisma results after the brand-organization filter
 * has guaranteed that every returned course belongs to an organization.
 */
function hasCourseSearchOrganization(course: CourseSearchRow): course is CourseWithOrganization {
  return course.organization !== null;
}

/**
 * Separates exact and partial matches so pagination preserves the product's
 * exact-match-first rule without loading every preceding result into memory.
 * When language is only a preference, each match group is split again so the
 * preferred language remains ahead of every other language on every page.
 */
function getCourseSearchBuckets({
  baseWhere,
  filterByLanguage,
  language,
  normalizedSearch,
}: {
  baseWhere: CourseSearchWhere;
  filterByLanguage?: boolean;
  language?: string;
  normalizedSearch: string;
}): CourseSearchWhere[] {
  const exactMatchWhere = { ...baseWhere, normalizedTitle: normalizedSearch };

  const containsMatchWhere = {
    ...baseWhere,
    NOT: { normalizedTitle: normalizedSearch },
    normalizedTitle: { contains: normalizedSearch, mode: "insensitive" as const },
  };

  if (!language || filterByLanguage) {
    return [exactMatchWhere, containsMatchWhere];
  }

  return [
    { ...exactMatchWhere, language },
    { ...containsMatchWhere, language },
    { ...exactMatchWhere, language: { not: language } },
    { ...containsMatchWhere, language: { not: language } },
  ];
}

/**
 * Adds bucket sizes to calculate where one bucket begins in the combined,
 * ranked result set. The sum is isolated here to keep page-window math
 * declarative and independently readable.
 */
function sumCourseSearchResults(counts: number[]): number {
  return counts.reduce((total, count) => total + count, 0);
}

/**
 * Converts one ranked search bucket into the part that overlaps the requested
 * page. This keeps database reads bounded to the page size even when a cursor
 * points far beyond the first 100 results.
 */
function getCourseSearchSegment({
  bucketCount,
  bucketCounts,
  bucketIndex,
  limit,
  offset,
}: {
  bucketCount: number;
  bucketCounts: number[];
  bucketIndex: number;
  limit: number;
  offset: number;
}): CourseSearchSegment | null {
  const bucketStart = sumCourseSearchResults(bucketCounts.slice(0, bucketIndex));
  const bucketEnd = bucketStart + bucketCount;
  const pageEnd = offset + limit;
  const overlapStart = Math.max(bucketStart, offset);
  const overlapEnd = Math.min(bucketEnd, pageEnd);

  if (overlapStart >= overlapEnd) {
    return null;
  }

  return { bucketIndex, skip: overlapStart - bucketStart, take: overlapEnd - overlapStart };
}

/**
 * Narrows nullable segment calculations after buckets outside the requested
 * page have been discarded.
 */
function isCourseSearchSegment(
  segment: CourseSearchSegment | null,
): segment is CourseSearchSegment {
  return segment !== null;
}

/**
 * Maps ranked bucket counts to the minimum set of bounded database reads
 * needed for the requested page.
 */
function getCourseSearchSegments({
  bucketCounts,
  limit,
  offset,
}: {
  bucketCounts: number[];
  limit: number;
  offset: number;
}): CourseSearchSegment[] {
  return bucketCounts
    .map((bucketCount, bucketIndex) =>
      getCourseSearchSegment({ bucketCount, bucketCounts, bucketIndex, limit, offset }),
    )
    .filter((segment) => isCourseSearchSegment(segment));
}

/**
 * Reads the first page from every ranked bucket concurrently. No bucket counts
 * are needed because the page starts at the beginning of the combined result
 * set; each read remains bounded to the requested page size.
 */
async function searchFirstCourseRows({
  buckets,
  limit,
}: {
  buckets: CourseSearchWhere[];
  limit: number;
}): Promise<CourseWithOrganization[]> {
  const pages = await Promise.all(
    buckets.map((where) =>
      prisma.course.findMany({
        include: { organization: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
        where,
      }),
    ),
  );

  return pages
    .flat()
    .filter((course) => hasCourseSearchOrganization(course))
    .slice(0, limit);
}

/**
 * Reads one later page from the ranked search buckets. Counting first is a
 * concrete dependency for a nonzero offset because it lets the cursor skip
 * entire ranking groups without fetching every preceding result.
 */
async function searchCourseRows({
  filterByLanguage,
  language,
  limit,
  normalizedSearch,
  offset,
}: {
  filterByLanguage?: boolean;
  language?: string;
  limit: number;
  normalizedSearch: string;
  offset: number;
}): Promise<CourseWithOrganization[]> {
  const baseWhere = getPublishedCourseWhere({
    organization: { kind: "brand" } as const,
    ...getSearchLanguageFilter({ filterByLanguage, language }),
  });

  const buckets = getCourseSearchBuckets({
    baseWhere,
    filterByLanguage,
    language,
    normalizedSearch,
  });

  if (offset === 0) {
    return searchFirstCourseRows({ buckets, limit });
  }

  const bucketCounts = await Promise.all(buckets.map((where) => prisma.course.count({ where })));
  const segments = getCourseSearchSegments({ bucketCounts, limit, offset });

  const pages = await Promise.all(
    segments.map((segment) =>
      prisma.course.findMany({
        include: { organization: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: segment.skip,
        take: segment.take,
        where: buckets[segment.bucketIndex],
      }),
    ),
  );

  return pages.flat().filter((course) => hasCourseSearchOrganization(course));
}

/**
 * Searches the public course catalog with a bounded result count for internal
 * consumers such as the command palette.
 */
export async function searchCourses(
  params: SearchCoursesParams,
): Promise<CourseWithOrganization[]> {
  const normalizedSearch = normalizeString(params.query);

  if (!normalizedSearch) {
    return [];
  }

  return searchCourseRows({
    filterByLanguage: params.filterByLanguage,
    language: params.language,
    limit: clampQueryItems(params.limit ?? DEFAULT_SEARCH_LIMIT),
    normalizedSearch,
    offset: Math.max(Math.trunc(params.offset ?? 0), 0),
  });
}
