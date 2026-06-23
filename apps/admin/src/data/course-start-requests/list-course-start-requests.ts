import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import {
  type CourseStartRequestGetPayload,
  type CourseStartRequestWhereInput,
  prisma,
} from "@zoonk/db";

const COURSE_START_SCOPES = [
  "exam",
  "language",
  "personalized",
  "question",
  "topic",
  "unsafe",
] as const;

const courseStartRequestInclude = { course: true } as const;

type CourseStartRequestListResult = {
  requests: CourseStartRequestGetPayload<{ include: typeof courseStartRequestInclude }>[];
  total: number;
};

/**
 * Keeps optional Prisma clauses type-safe after building a conditional list of
 * prompt/title/course/scope matches for the admin search box.
 */
function isCourseStartRequestWhereInput(
  value: CourseStartRequestWhereInput | null,
): value is CourseStartRequestWhereInput {
  return Boolean(value);
}

/**
 * Maps a free-text admin search to an exact routing scope when the search term
 * is one of the stored enum values.
 */
function getScopeFilter(search: string) {
  const normalizedSearch = search.trim().toLowerCase();
  return COURSE_START_SCOPES.find((scope) => scope === normalizedSearch);
}

const cachedListCourseStartRequests = cacheAdminData(
  async (limit: number, offset: number, search?: string): Promise<CourseStartRequestListResult> => {
    const where = buildCourseStartRequestWhere({ search });

    const [requests, total] = await Promise.all([
      prisma.courseStartRequest.findMany({
        include: courseStartRequestInclude,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        where,
      }),
      prisma.courseStartRequest.count({ where }),
    ]);

    return { requests, total };
  },
);

export const countCourseStartRequests = cacheAdminData(() => prisma.courseStartRequest.count());

export type ListedCourseStartRequest = Awaited<
  ReturnType<typeof listCourseStartRequests>
>["requests"][number];

/**
 * Admin pages use object parameters at the call site, while the cached query
 * keeps primitive positional arguments internally so React cache can reuse the
 * same database result during one render pass.
 */
export async function listCourseStartRequests({
  limit,
  offset,
  search,
}: {
  limit: number;
  offset: number;
  search?: string;
}) {
  return cachedListCourseStartRequests(limit, offset, search);
}

/**
 * Start requests are useful even when an admin only remembers part of the raw
 * prompt, canonical title, scope, or generated course. Searching visible text
 * keeps the read-only log predictable without adding separate filters.
 */
function buildCourseStartRequestWhere({
  search,
}: {
  search?: string;
}): CourseStartRequestWhereInput | undefined {
  if (search) {
    const searchFilter = { contains: search, mode: "insensitive" as const };
    const scope = getScopeFilter(search);

    const clauses: (CourseStartRequestWhereInput | null)[] = [
      { prompt: searchFilter },
      { canonicalTitle: searchFilter },
      { targetLanguage: searchFilter },
      { course: { title: searchFilter } },
      scope ? { scope } : null,
    ];

    return { OR: clauses.filter((clause) => isCourseStartRequestWhereInput(clause)) };
  }
}
