import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Course, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";

/**
 * Alternative-title mutations use `courseId` from the client, so this helper
 * exists to resolve the real course record on the server and re-check that the
 * caller still has update access to that course's organization before any read
 * or write happens.
 */
export async function getAuthorizedAlternativeTitleCourse(params: {
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

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: course.organizationId,
    permission: "update",
  });

  if (!hasPermission) {
    return { data: null, error: new AppError(ErrorCode.forbidden) };
  }

  return { data: course, error: null };
}
