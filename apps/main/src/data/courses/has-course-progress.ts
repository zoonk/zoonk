import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { cache } from "react";

/**
 * Course pages use the enrollment row as the boundary between marketing and
 * learning modes. Lesson progress can exist from partial or older paths, but
 * only CourseUser means the learner has an active relationship with the course.
 */
const cachedHasCourseProgress = cache(async (courseId: string, headers?: Headers) => {
  const session = await getSession(headers);
  const userId = session?.user.id;

  if (!userId) {
    return false;
  }

  const courseUser = await prisma.courseUser.findUnique({
    where: { courseUser: { courseId, userId } },
  });

  return Boolean(courseUser);
});

/**
 * Exposes the page-mode decision as a named data helper so the course route can
 * stay focused on choosing between the landing view and the learning grid.
 */
export function hasCourseProgress({ courseId, headers }: { courseId: string; headers?: Headers }) {
  return cachedHasCourseProgress(courseId, headers);
}
