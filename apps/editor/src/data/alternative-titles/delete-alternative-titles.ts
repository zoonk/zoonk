import "server-only";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { toSlug } from "@zoonk/utils/string";
import { getAuthorizedAlternativeTitleCourse } from "./get-authorized-course";

/**
 * Deleting alternative titles changes duplicate-detection data, so this helper
 * exists to enforce course update permission before removing any stored slugs.
 */
export async function deleteAlternativeTitles(params: {
  courseId: number;
  headers?: Headers;
  titles: string[];
}): Promise<SafeReturn<null>> {
  const { error: courseError } = await getAuthorizedAlternativeTitleCourse({
    courseId: params.courseId,
    headers: params.headers,
  });

  if (courseError) {
    return { data: null, error: courseError };
  }

  const slugs = params.titles.map((title) => toSlug(title));

  if (slugs.length === 0) {
    return { data: null, error: null };
  }

  const { error } = await safeAsync(() =>
    prisma.courseAlternativeTitle.deleteMany({
      where: {
        courseId: params.courseId,
        slug: { in: slugs },
      },
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data: null, error: null };
}
