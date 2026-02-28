import "server-only";
import { type Course, type Organization, prisma } from "@zoonk/db";
import { MAX_QUERY_ITEMS, clampQueryItems } from "@zoonk/db/utils";
import { DEFAULT_SEARCH_LIMIT } from "@zoonk/utils/constants";
import { mergeSearchResults } from "@zoonk/utils/search";
import { normalizeString } from "@zoonk/utils/string";

type CourseWithOrganization = Course & {
  organization: Organization;
};

export async function searchCourses(params: {
  query: string;
  language?: string;
  limit?: number;
  offset?: number;
}): Promise<CourseWithOrganization[]> {
  const limit = clampQueryItems(params.limit ?? DEFAULT_SEARCH_LIMIT);
  const offset = Math.min(params.offset ?? 0, MAX_QUERY_ITEMS);
  const normalizedSearch = normalizeString(params.query);

  if (!normalizedSearch) {
    return [];
  }

  const baseWhere = {
    isPublished: true,
    organization: { kind: "brand" } as const,
  };

  const [exactMatch, containsMatches] = await Promise.all([
    prisma.course.findFirst({
      include: { organization: true },
      where: {
        ...baseWhere,
        normalizedTitle: normalizedSearch,
      },
    }),
    prisma.course.findMany({
      include: { organization: true },
      orderBy: { createdAt: "desc" },
      take: limit + offset + 1,
      where: {
        ...baseWhere,
        normalizedTitle: { contains: normalizedSearch, mode: "insensitive" },
      },
    }),
  ]);

  const merged = mergeSearchResults(exactMatch, containsMatches);

  const filtered = merged.filter(
    (course): course is CourseWithOrganization => course.organization !== null,
  );

  const sorted = params.language
    ? filtered.toSorted((a, b) => {
        const aMatch = a.language === params.language ? 0 : 1;
        const bMatch = b.language === params.language ? 0 : 1;
        return aMatch - bMatch;
      })
    : filtered;

  return sorted.slice(offset, offset + limit);
}
