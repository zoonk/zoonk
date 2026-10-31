import "server-only";
import { getPublishedCourseWhere, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../users/get-session";
import { getOwnPrivateCourseWhere } from "./_utils/own-private-course";

type CourseActivity = { courseId: string; lastActivityAt: Date };
type StartedChapter = { chapterId: string; lastActivityAt: Date };

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

/** Returns null without a session; courses are ordered by most recent activity. */
export async function listCurrentUserCourses({ query }: { query?: string } = {}) {
  const session = await getSession();
  return session ? findCurrentUserCourses({ query: query?.trim(), userId: session.user.id }) : null;
}

/** Returns null for unauthenticated callers. */
export async function listCurrentUserCoursesPage({
  limit,
  offset = 0,
  query,
}: {
  limit: number;
  offset?: number;
  query?: string;
}) {
  const courses = await listCurrentUserCourses({ query });

  if (!courses) {
    return null;
  }

  const pageSize = clampQueryItems(limit);
  const start = Math.max(Math.trunc(offset), 0);
  const page = courses.slice(start, start + pageSize + 1);

  return { courses: page.slice(0, pageSize), hasMore: page.length > pageSize };
}
