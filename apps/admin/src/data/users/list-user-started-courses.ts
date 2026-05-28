import "server-only";
import { isAdmin } from "@/lib/admin-guard";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export type UserStartedCourse = Awaited<ReturnType<typeof findUserStartedCourseRows>>[number];

const cachedListUserStartedCourses = cache(async (userId: string) => {
  if (!(await isAdmin())) {
    return [];
  }

  return findUserStartedCourseRows({ userId });
});

/**
 * The detail page passes route params through a cached primitive value so
 * repeated sections can reuse the same database read without object identity
 * breaking React's cache lookup.
 */
export async function listUserStartedCourses(params: { userId: string }) {
  return cachedListUserStartedCourses(params.userId);
}

/**
 * CourseUser is the durable "started this course" record. Sorting by the
 * course's own update timestamp keeps this admin view simple and avoids
 * computing lesson-level progress for a support-oriented course list.
 */
function findUserStartedCourseRows({ userId }: { userId: string }) {
  return prisma.courseUser.findMany({
    include: { course: { include: { organization: true } } },
    orderBy: [{ course: { updatedAt: "desc" } }, { startedAt: "desc" }, { id: "asc" }],
    where: { userId },
  });
}
