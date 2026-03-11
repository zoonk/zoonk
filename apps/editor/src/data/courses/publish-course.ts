import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Course, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";

export async function toggleCoursePublished(params: {
  courseId: number;
  headers?: Headers;
  isPublished: boolean;
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

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: course.organizationId,
    permission: "update",
  });

  if (!hasPermission) {
    return { data: null, error: new AppError(ErrorCode.forbidden) };
  }

  const { data, error } = await safeAsync(() =>
    params.isPublished
      ? prisma.$transaction(async (tx) => {
          const updated = await tx.course.update({
            data: { isPublished: true },
            where: { id: course.id },
          });

          await Promise.all([
            tx.chapter.updateMany({
              data: { isPublished: true },
              where: { courseId: course.id },
            }),
            tx.lesson.updateMany({
              data: { isPublished: true },
              where: { chapter: { courseId: course.id } },
            }),
            tx.activity.updateMany({
              data: { isPublished: true },
              where: { lesson: { chapter: { courseId: course.id } } },
            }),
            tx.step.updateMany({
              data: { isPublished: true },
              where: { activity: { lesson: { chapter: { courseId: course.id } } } },
            }),
          ]);

          return updated;
        })
      : prisma.course.update({
          data: { isPublished: false },
          where: { id: course.id },
        }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}
