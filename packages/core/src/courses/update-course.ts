import "server-only";

import { type Course, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { hasCoursePermission } from "../organizations";

export async function updateCourse(params: {
  courseId: number;
  description?: string;
  slug?: string;
  title?: string;
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
      data: {
        ...(params.description !== undefined && {
          description: params.description,
        }),
        ...(params.slug !== undefined && { slug: toSlug(params.slug) }),
        ...(params.title !== undefined && {
          normalizedTitle: normalizeString(params.title),
          title: params.title,
        }),
      },
      where: { id: course.id },
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}
