import "server-only";
import { type CourseGetPayload, getListedCourseWhere, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { type CourseCategory } from "@zoonk/utils/categories";
import { cacheTag } from "next/cache";
import { COURSE_LIST_CACHE_TAG } from "../cache/tags";
import { withOutlineTotals } from "./_utils/course-outline-totals";

export const LIST_COURSES_LIMIT = 20;

type ListCoursesInput = {
  category?: CourseCategory;
  cursor?: string;
  language: string;
  limit?: number;
};

type ListCoursesPageInput = Omit<ListCoursesInput, "cursor"> & { offset?: number };

const COURSE_CARD_SELECT = {
  categories: {
    orderBy: { createdAt: "asc" },
    select: { category: true, createdAt: true },
    take: 1,
  },
  description: true,
  id: true,
  imageUrl: true,
  language: true,
  organization: { select: { id: true, logo: true, name: true, slug: true } },
  slug: true,
  targetLanguage: true,
  title: true,
} as const;

type CourseListRow = CourseGetPayload<{ select: typeof COURSE_CARD_SELECT }>;

type PublishedBrandCourse = Omit<CourseListRow, "organization"> & {
  organization: NonNullable<CourseListRow["organization"]>;
};

function hasBrandOrganization(course: CourseListRow): course is PublishedBrandCourse {
  return course.organization !== null;
}

async function findCourses({
  category,
  cursor,
  language,
  offset,
  take,
}: {
  category?: CourseCategory;
  cursor?: string;
  language: string;
  offset?: number;
  take: number;
}) {
  const courses = await prisma.course.findMany({
    orderBy: [{ userCount: "desc" }, { id: "desc" }],
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    ...(offset !== undefined && { skip: Math.max(Math.trunc(offset), 0) }),
    select: COURSE_CARD_SELECT,
    take,
    where: getListedCourseWhere({
      language,
      ...(category && { categories: { some: { category } } }),
    }),
  });

  return withOutlineTotals(courses.filter((course) => hasBrandOrganization(course)));
}

/** Outline totals can lag writes until the listing's default cache revalidation. */
export async function listCourses(params: ListCoursesInput) {
  "use cache";
  cacheTag(COURSE_LIST_CACHE_TAG);

  const limit = clampQueryItems(params.limit ?? LIST_COURSES_LIMIT);

  return findCourses({
    category: params.category,
    cursor: params.cursor,
    language: params.language,
    take: limit,
  });
}

/** Returns at most 100 courses; hasMore indicates another page. */
export async function listCoursesPage(
  params: ListCoursesPageInput,
): Promise<{ courses: CourseWithOrg[]; hasMore: boolean }> {
  "use cache";
  cacheTag(COURSE_LIST_CACHE_TAG);

  const limit = clampQueryItems(params.limit ?? LIST_COURSES_LIMIT);

  const courses = await findCourses({
    category: params.category,
    language: params.language,
    offset: params.offset,
    take: limit + 1,
  });

  return { courses: courses.slice(0, limit), hasMore: courses.length > limit };
}

export type CourseWithOrg = Awaited<ReturnType<typeof listCourses>>[number];
