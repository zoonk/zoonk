import "server-only";
import {
  type CourseGetPayload,
  type Organization,
  getPublishedCourseWhere,
  prisma,
} from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { type CourseCategory } from "@zoonk/utils/categories";
import { cacheTag } from "next/cache";
import { COURSE_LIST_CACHE_TAG } from "../cache/tags";

export const LIST_COURSES_LIMIT = 20;

type ListCoursesInput = {
  category?: CourseCategory;
  cursor?: string;
  language: string;
  limit?: number;
};

type ListCoursesPageInput = Omit<ListCoursesInput, "cursor"> & { offset?: number };

type CourseListRow = CourseGetPayload<{ include: { organization: true } }>;
type PublishedBrandCourse = Omit<CourseListRow, "organization"> & { organization: Organization };

/**
 * Narrows the nullable Prisma relation after the brand-organization predicate
 * has guaranteed that every public catalog row belongs to an organization.
 */
function hasBrandOrganization(course: CourseListRow): course is PublishedBrandCourse {
  return course.organization !== null;
}

/**
 * Executes the shared published-course query after each public entry point has
 * bounded its page window. Keeping the filtering and popularity order here
 * prevents the web cursor list and API offset page from drifting apart.
 */
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
    include: { organization: true },
    orderBy: [{ userCount: "desc" }, { id: "desc" }],
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    ...(offset !== undefined && { skip: Math.max(Math.trunc(offset), 0) }),
    take,
    where: getPublishedCourseWhere({
      language,
      organization: { kind: "brand" },
      ...(category && { categories: { some: { category } } }),
    }),
  });

  return courses.filter((course) => hasBrandOrganization(course));
}

/**
 * Lists the cached published brand catalog in a stable popularity order so web
 * and API consumers share filtering, cursor pagination, and invalidation.
 */
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

/**
 * Returns one offset-based course page with an explicit continuation signal.
 * The extra internal row keeps the public maximum page size at 100 without
 * leaking transport pagination into the reusable catalog query.
 */
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
