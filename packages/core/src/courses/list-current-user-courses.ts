import "server-only";
import { getPublishedCourseWhere, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { isUuid } from "@zoonk/utils/uuid";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getUserProgressCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { getOwnPrivateCourseWhere } from "./_utils/own-private-course";

type CourseActivity = { courseId: string; lastActivityAt: Date };
type StartedChapter = { chapterId: string; lastActivityAt: Date };

/** The courses the learner's goals are built on, active or not, as of the goal's last change. */
async function listGoalCourses(userId: string): Promise<CourseActivity[]> {
  const goals = await prisma.goal.findMany({
    select: { primaryCourseId: true, updatedAt: true },
    where: { primaryCourseId: { not: null }, userId },
  });

  return goals.flatMap(({ primaryCourseId, updatedAt }) =>
    primaryCourseId ? [{ courseId: primaryCourseId, lastActivityAt: updatedAt }] : [],
  );
}

function toCourseActivity({
  homeCourseIds,
  started,
}: {
  homeCourseIds: Map<string, string | null>;
  started: StartedChapter;
}): CourseActivity[] {
  const courseId = homeCourseIds.get(started.chapterId);
  return courseId ? [{ courseId, lastActivityAt: started.lastActivityAt }] : [];
}

/**
 * The courses the learner started lessons in. Each lesson run names the lesson's home chapter,
 * which lives in its home course. The ledger is read on its own and the chapters looked up
 * afterwards, so learner rows are never joined with content.
 */
async function listStartedCourses(userId: string): Promise<CourseActivity[]> {
  const rows = await prisma.$queryRaw<StartedChapter[]>`
    SELECT content_ids->>'chapterId' AS "chapterId", max(started_at) AS "lastActivityAt"
    FROM learning_events
    WHERE user_id = ${userId}::uuid AND kind = 'lesson' AND content_ids->>'chapterId' IS NOT NULL
    GROUP BY 1`;

  const started = rows.filter((row) => isUuid(row.chapterId));

  if (started.length === 0) {
    return [];
  }

  const chapters = await prisma.chapter.findMany({
    select: { homeCourseId: true, id: true },
    where: { id: { in: started.map((row) => row.chapterId) } },
  });

  const homeCourseIds = new Map(chapters.map((chapter) => [chapter.id, chapter.homeCourseId]));
  return started.flatMap((row) => toCourseActivity({ homeCourseIds, started: row }));
}

function byLatestActivity(first: CourseActivity, second: CourseActivity) {
  return (
    second.lastActivityAt.getTime() - first.lastActivityAt.getTime() ||
    second.courseId.localeCompare(first.courseId)
  );
}

/** Course ids from most to least recent activity, each once. */
async function listRecentCourseIds(userId: string): Promise<string[]> {
  const [goalCourses, startedCourses] = await Promise.all([
    listGoalCourses(userId),
    listStartedCourses(userId),
  ]);

  const activities = [...goalCourses, ...startedCourses].toSorted(byLatestActivity);
  return [...new Set(activities.map((activity) => activity.courseId))];
}

function getQueryWhere(query?: string) {
  if (!query) {
    return {};
  }

  return {
    AND: [
      {
        OR: [
          { title: { contains: query, mode: "insensitive" as const } },
          { description: { contains: query, mode: "insensitive" as const } },
        ],
      },
    ],
  };
}

/**
 * The learner's courses: the ones their goals are built on and the ones they started lessons in,
 * most recent activity first. Only published brand courses and the learner's own private courses
 * are listed.
 */
async function findCurrentUserCourses({ query, userId }: { query?: string; userId: string }) {
  const courseIds = await listRecentCourseIds(userId);

  if (courseIds.length === 0) {
    return [];
  }

  const courses = await prisma.course.findMany({
    include: { organization: true },
    where: {
      OR: [
        getPublishedCourseWhere({ organization: { kind: "brand" } }),
        getOwnPrivateCourseWhere(userId),
      ],
      id: { in: courseIds },
      ...getQueryWhere(query),
    },
  });

  const coursesById = new Map(courses.map((course) => [course.id, course]));
  return courseIds.flatMap((courseId) => coursesById.get(courseId) ?? []);
}

/**
 * Returns the authenticated learner's courses without accepting an acting user ID. Guests without
 * a session get an empty list, and repeated callers in one request share the private cache.
 */
export async function listCurrentUserCourses() {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return [];
  }

  cacheTag(getGoalsCacheTag(session.user.id), getUserProgressCacheTag(session.user.id));
  return findCurrentUserCourses({ userId: session.user.id });
}

/**
 * Returns one page of the authenticated learner's courses, optionally filtered by title or
 * description, with an explicit continuation signal. A null result represents an unauthenticated
 * request, allowing the API adapter to emit 401 without moving authorization outside Core.
 */
export async function listCurrentUserCoursesPage({
  limit,
  offset = 0,
  query,
}: {
  limit: number;
  offset?: number;
  query?: string;
}) {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const pageSize = clampQueryItems(limit);
  const start = Math.max(Math.trunc(offset), 0);
  const courses = await findCurrentUserCourses({ query: query?.trim(), userId: session.user.id });
  const page = courses.slice(start, start + pageSize + 1);

  return { courses: page.slice(0, pageSize), hasMore: page.length > pageSize };
}
