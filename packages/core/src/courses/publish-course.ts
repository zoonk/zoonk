import "server-only";

import { type Course, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { hasCoursePermission } from "../orgs/org-permissions";

export async function toggleCoursePublished(params: {
  courseId: number;
  isPublished: boolean;
  headers?: Headers;
}): Promise<SafeReturn<Course>> {
  const { data: course, error: findError } = await safeAsync(() =>
    prisma.course.findUnique({
      select: { id: true, organizationId: true },
      where: { id: params.courseId },
    }),
  );

  if (findError) {
    return { data: null, error: findError };
  }

  if (!course) {
    return { data: null, error: new Error("Course not found") };
  }

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: course.organizationId,
    permission: "update",
  });

  if (!hasPermission) {
    return { data: null, error: new Error("Forbidden") };
  }

  const { data, error } = await safeAsync(() =>
    prisma.course.update({
      data: { isPublished: params.isPublished },
      where: { id: course.id },
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}
