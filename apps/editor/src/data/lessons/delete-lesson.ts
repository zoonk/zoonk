import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Lesson, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { getCurriculumDeletePlan } from "../curriculum-delete";

/**
 * Deletes untouched draft lessons, but archives lessons with learner history so
 * activity and attempt data are not removed by cascading lesson deletes.
 */
export async function deleteLesson(params: {
  lessonId: number;
  headers?: Headers;
}): Promise<SafeReturn<Lesson>> {
  const { data: lesson, error: findError } = await safeAsync(() =>
    prisma.lesson.findUnique({
      where: { id: params.lessonId },
    }),
  );

  if (findError) {
    return { data: null, error: findError };
  }

  if (!lesson) {
    return { data: null, error: new AppError(ErrorCode.lessonNotFound) };
  }

  const deletePlan = await getCurriculumDeletePlan({
    isPublished: lesson.isPublished,
    target: {
      entityType: "lesson",
      lesson,
    },
  });

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: lesson.organizationId,
    permission: deletePlan.permission,
  });

  if (!hasPermission) {
    return { data: null, error: new AppError(ErrorCode.forbidden) };
  }

  const { data: deletedLesson, error } = await safeAsync(() =>
    removeLesson({
      lesson,
      mode: deletePlan.mode,
    }),
  );

  if (error || !deletedLesson) {
    return { data: null, error };
  }

  return { data: deletedLesson, error: null };
}

/**
 * Preserves activity descendants for learner-touched lessons by archiving the
 * lesson row instead of allowing the database cascade to remove everything below it.
 */
function removeLesson({
  lesson,
  mode,
}: {
  lesson: Lesson;
  mode: Awaited<ReturnType<typeof getCurriculumDeletePlan>>["mode"];
}) {
  if (mode === "archive") {
    return prisma.lesson.update({
      data: { archivedAt: new Date() },
      where: { id: lesson.id },
    });
  }

  return prisma.lesson.delete({
    where: { id: lesson.id },
  });
}
