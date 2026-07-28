import "server-only";
import { prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { cacheTag } from "next/cache";
import { COURSE_LIST_CACHE_TAG, getUserProgressCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";

/**
 * Loads the CourseUser-backed library for one trusted session-derived learner,
 * preserving the current most-recently-started ordering and visibility rules.
 */
async function findCurrentUserCourses({
  offset,
  take,
  userId,
}: {
  offset?: number;
  take?: number;
  userId: string;
}) {
  const rows = await prisma.courseUser.findMany({
    include: { course: { include: { organization: true } } },
    orderBy: [{ startedAt: "desc" }, { courseId: "desc" }],
    ...(take !== undefined && { take }),
    ...(offset !== undefined && { skip: Math.max(Math.trunc(offset), 0) }),
    where: {
      course: { OR: [{ organization: { kind: "brand" } }, { organizationId: null }] },
      userId,
    },
  });

  return rows.map((row) => row.course);
}

/**
 * Returns the authenticated learner's course library without accepting an
 * acting user ID. Main keeps its existing empty guest result while repeated
 * callers in one request share the same private-cache execution.
 */
export async function listCurrentUserCourses() {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return [];
  }

  cacheTag(COURSE_LIST_CACHE_TAG, getUserProgressCacheTag(session.user.id));
  return findCurrentUserCourses({ userId: session.user.id });
}

/**
 * Returns one authenticated learner-owned course page and an explicit
 * continuation signal. A null result represents an unauthenticated request,
 * allowing the API adapter to emit 401 without moving authorization outside
 * Core.
 */
export async function listCurrentUserCoursesPage({
  limit,
  offset = 0,
}: {
  limit: number;
  offset?: number;
}) {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const pageSize = clampQueryItems(limit);

  const courses = await findCurrentUserCourses({
    offset,
    take: pageSize + 1,
    userId: session.user.id,
  });

  return { courses: courses.slice(0, pageSize), hasMore: courses.length > pageSize };
}
