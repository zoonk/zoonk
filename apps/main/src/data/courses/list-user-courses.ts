import "server-only";
import { COURSE_LIST_CACHE_TAG, getUserProgressCacheTag } from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { type Course, type Organization, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";

type UserCourse = Course & { organization: Organization | null };

/**
 * Shares the learner's CourseUser-backed list until course metadata or their
 * progress changes. CourseUser rows do not depend on lesson completion here.
 */
async function findUserCourses(userId: string): Promise<UserCourse[]> {
  "use cache";

  cacheTag(COURSE_LIST_CACHE_TAG, getUserProgressCacheTag(userId));

  const rows = await prisma.courseUser.findMany({
    include: { course: { include: { organization: true } } },
    orderBy: { startedAt: "desc" },
    where: {
      course: { OR: [{ organization: { kind: "brand" } }, { organizationId: null }] },
      userId,
    },
  });

  return rows.map((row) => row.course);
}

/** Returns no user-specific courses when the catalog is rendered for a signed-out visitor. */
export async function listUserCourses(): Promise<UserCourse[]> {
  const session = await getSession();

  if (!session) {
    return [];
  }

  return findUserCourses(session.user.id);
}
