import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { getSession } from "@zoonk/core/users/session/get";
import { type Course, type Organization, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

type UserCourse = Course & { organization: Organization | null };

/**
 * My Courses is a resume surface, not raw start history. Opening a lesson
 * creates a lesson_progress row with completedAt null, so the list must require
 * at least one completed lesson in the same course before showing it.
 */
function getCompletedUserCourseWhere({ userId }: { userId: string }) {
  return {
    course: {
      OR: [{ organization: { kind: "brand" } }, { organizationId: null }],
      chapters: {
        some: { lessons: { some: { progress: { some: { completedAt: { not: null }, userId } } } } },
      },
    },
    userId,
  };
}

/**
 * The My Courses page only shows courses where the learner has real completion
 * progress, while preserving the existing course metadata needed by the list UI.
 */
export const listUserCourses = cache(
  async (headers?: Headers): Promise<SafeReturn<UserCourse[]>> => {
    const session = await getSession(headers);

    if (!session) {
      return { data: null, error: new AppError(ErrorCode.unauthorized) };
    }

    const userId = session.user.id;

    const { data, error } = await safeAsync(() =>
      prisma.courseUser.findMany({
        include: { course: { include: { organization: true } } },
        orderBy: { startedAt: "desc" },
        where: getCompletedUserCourseWhere({ userId }),
      }),
    );

    if (error) {
      return { data: null, error };
    }

    const courses = data.map((cu) => cu.course);

    return { data: courses, error: null };
  },
);
