import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import {
  CourseFormat,
  type CoursePromptGetPayload,
  CoursePromptIntent,
  type CoursePromptWhereInput,
  prisma,
} from "@zoonk/db";

const COURSE_PROMPT_INTENTS = Object.values(CoursePromptIntent);
const COURSE_FORMATS = Object.values(CourseFormat);

const coursePromptInclude = { course: true } as const;

type CoursePromptListResult = {
  prompts: CoursePromptGetPayload<{ include: typeof coursePromptInclude }>[];
  total: number;
};

/**
 * Keeps optional Prisma clauses type-safe after building a conditional list of
 * prompt, title, intent, format, and course matches for the admin search box.
 */
function isCoursePromptWhereInput(
  value: CoursePromptWhereInput | null,
): value is CoursePromptWhereInput {
  return Boolean(value);
}

/**
 * Maps a free-text admin search to an exact enum value when the search term is
 * one of the stored prompt intents or course formats.
 */
function getEnumFilter<const TValue extends string>(
  search: string,
  values: readonly TValue[],
): TValue | null {
  const normalizedSearch = search.trim().toLowerCase();
  return values.find((value) => value === normalizedSearch) ?? null;
}

const cachedListCoursePrompts = cacheAdminData(
  async (limit: number, offset: number, search?: string): Promise<CoursePromptListResult> => {
    const where = buildCoursePromptWhere({ search });

    const [prompts, total] = await Promise.all([
      prisma.coursePrompt.findMany({
        include: coursePromptInclude,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        where,
      }),
      prisma.coursePrompt.count({ where }),
    ]);

    return { prompts, total };
  },
);

export const countCoursePrompts = cacheAdminData(() => prisma.coursePrompt.count());

export type ListedCoursePrompt = Awaited<ReturnType<typeof listCoursePrompts>>["prompts"][number];

/**
 * Admin pages use object parameters at the call site, while the cached query
 * keeps primitive positional arguments internally so React cache can reuse the
 * same database result during one render pass.
 */
export async function listCoursePrompts({
  limit,
  offset,
  search,
}: {
  limit: number;
  offset: number;
  search?: string;
}) {
  return cachedListCoursePrompts(limit, offset, search);
}

/**
 * Course prompts are useful even when an admin only remembers part of the raw
 * prompt, canonical title, intent, format, or generated course. Searching visible text
 * keeps the read-only log predictable without adding separate filters.
 */
function buildCoursePromptWhere({
  search,
}: {
  search?: string;
}): CoursePromptWhereInput | undefined {
  if (search) {
    const searchFilter = { contains: search, mode: "insensitive" as const };
    const courseFormat = getEnumFilter(search, COURSE_FORMATS);
    const intent = getEnumFilter(search, COURSE_PROMPT_INTENTS);

    const clauses: (CoursePromptWhereInput | null)[] = [
      { prompt: searchFilter },
      { canonicalTitle: searchFilter },
      { targetLanguage: searchFilter },
      { course: { title: searchFilter } },
      courseFormat ? { courseFormat } : null,
      intent ? { intent } : null,
    ];

    return { OR: clauses.filter((clause) => isCoursePromptWhereInput(clause)) };
  }
}
