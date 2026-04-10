import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Course, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { getArchivedSlug, getCurriculumDeletePlan } from "../curriculum-delete";

/**
 * Deletes draft courses with no learner history, but archives historically
 * significant courses instead so we do not cascade away learner facts.
 */
export async function deleteCourse(params: {
  courseId: number;
  headers?: Headers;
}): Promise<SafeReturn<Course>> {
  const { data: course, error: findError } = await safeAsync(() =>
    prisma.course.findUnique({
      where: { id: params.courseId },
    }),
  );

  if (findError) {
    return { data: null, error: findError };
  }

  if (!course) {
    return { data: null, error: new AppError(ErrorCode.courseNotFound) };
  }

  const deletePlan = await getCurriculumDeletePlan({
    isPublished: course.isPublished,
    target: {
      course,
      entityType: "course",
    },
  });

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: course.organizationId,
    permission: deletePlan.permission,
  });

  if (!hasPermission) {
    return { data: null, error: new AppError(ErrorCode.forbidden) };
  }

  const { data: deletedCourse, error } = await safeAsync(() =>
    removeCourse({
      course,
      mode: deletePlan.mode,
    }),
  );

  if (error || !deletedCourse) {
    return { data: null, error };
  }

  return { data: deletedCourse, error: null };
}

/**
 * Uses hard delete only when the lifecycle plan says the course has no protected
 * learner history. Otherwise we mark it archived and keep descendants intact for
 * later read-path filtering work.
 */
function removeCourse({
  course,
  mode,
}: {
  course: Course;
  mode: Awaited<ReturnType<typeof getCurriculumDeletePlan>>["mode"];
}) {
  if (mode === "archive") {
    return prisma.$transaction(async (tx) => {
      await tx.courseAlternativeTitle.deleteMany({
        where: { courseId: course.id },
      });

      return tx.course.update({
        data: {
          archivedAt: new Date(),
          slug: getArchivedSlug({
            id: course.id,
            slug: course.slug,
          }),
        },
        where: { id: course.id },
      });
    });
  }

  return prisma.course.delete({ where: { id: course.id } });
}
