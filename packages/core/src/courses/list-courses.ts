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

/**
 * What a course card shows (its link, mark, subject, words and numbers) and the public parts of its
 * brand. The catalog list reaches the browser and the API, so internal fields (generation runs,
 * prompt versions, landing-page content, billing) stay out. The subject is the course's first
 * category, the one its pages take their color from.
 */
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

/**
 * Lists the cached catalog of listed courses (`getListedCourseWhere`) in a stable popularity order
 * so web and API consumers share filtering, cursor pagination, and invalidation. Each course
 * carries its lesson count and estimated minutes; they follow outline changes within the default
 * revalidation, like the listing itself.
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
