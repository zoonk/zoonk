import "server-only";
import { type Course, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { getAuthorizedCourse } from "./get-authorized-course";

export async function updateCourse(params: {
  courseId: string;
  description?: string;
  headers?: Headers;
  imageUrl?: string | null;
  slug?: string;
  title?: string;
}): Promise<SafeReturn<Course>> {
  const { data: course, error: courseError } = await getAuthorizedCourse({
    courseId: params.courseId,
    headers: params.headers,
  });

  if (courseError) {
    return { data: null, error: courseError };
  }

  const { data, error } = await safeAsync(() =>
    prisma.course.update({
      data: {
        ...(params.description !== undefined && {
          description: params.description,
        }),
        ...(params.imageUrl !== undefined && { imageUrl: params.imageUrl }),
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
