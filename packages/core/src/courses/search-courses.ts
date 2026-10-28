import "server-only";
import { type CourseGetPayload, type Organization, getListedCourseWhere, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { DEFAULT_SEARCH_LIMIT } from "@zoonk/utils/search";
import { normalizeString } from "@zoonk/utils/string";
import { getSearchLanguageFilter } from "../_utils/search-language-filter";

type CourseSearchRow = CourseGetPayload<{ include: { organization: true } }>;

type CourseWithOrganization = Omit<CourseSearchRow, "organization"> & {
  organization: Organization;
};

type CourseSearchWhere = ReturnType<typeof getListedCourseWhere>;

type SearchCoursesParams = {
  filterByLanguage?: boolean;
  query: string;
  language?: string;
  limit?: number;
  offset?: number;
};

type CourseSearchSegment = { bucketIndex: number; skip: number; take: number };

function hasCourseSearchOrganization(course: CourseSearchRow): course is CourseWithOrganization {
  return course.organization !== null;
}

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

function sumCourseSearchResults(counts: number[]): number {
  return counts.reduce((total, count) => total + count, 0);
}

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

function isCourseSearchSegment(
  segment: CourseSearchSegment | null,
): segment is CourseSearchSegment {
  return segment !== null;
}

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
  const baseWhere = getListedCourseWhere(getSearchLanguageFilter({ filterByLanguage, language }));

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
