import "server-only";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";
import { getAuthorizedActiveCourse } from "../courses/get-authorized-course";

const cachedChapterSlugExists = cache(async (courseId: string, slug: string): Promise<boolean> => {
  const { data } = await safeAsync(() =>
    prisma.chapter.findFirst({
      where: { courseId, slug },
    }),
  );

  return data !== null;
});

/**
 * Chapter slug checks receive a course id from the client, so this helper
 * revalidates the active course and the caller's update permission before it
 * asks whether that course already owns the candidate slug.
 */
export async function chapterSlugExists(params: {
  courseId: string;
  headers?: Headers;
  slug: string;
}): Promise<boolean> {
  if (!params.slug.trim()) {
    return false;
  }

  const { data: course, error } = await getAuthorizedActiveCourse({
    courseId: params.courseId,
    headers: params.headers,
  });

  if (error) {
    return false;
  }

  return cachedChapterSlugExists(course.id, params.slug);
}
