import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type CourseChapter, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";

export async function addChapterToCourse(params: {
  chapterId: number;
  courseId: number;
  headers?: Headers;
  position: number;
}): Promise<SafeReturn<CourseChapter>> {
  const { data: result, error: findError } = await safeAsync(() =>
    Promise.all([
      prisma.course.findUnique({
        where: { id: params.courseId },
      }),
      prisma.chapter.findUnique({
        where: { id: params.chapterId },
      }),
    ]),
  );

  if (findError) {
    return { data: null, error: findError };
  }

  const [course, chapter] = result;

  if (!course) {
    return { data: null, error: new Error("Course not found") };
  }

  if (!chapter) {
    return { data: null, error: new Error("Chapter not found") };
  }

  if (course.organizationId !== chapter.organizationId) {
    return {
      data: null,
      error: new Error(
        "Chapter and course must belong to the same organization",
      ),
    };
  }

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: course.organizationId,
    permission: "update",
  });

  if (!hasPermission) {
    return { data: null, error: new Error("Forbidden") };
  }

  const { data: courseChapter, error } = await safeAsync(() =>
    prisma.courseChapter.create({
      data: {
        chapterId: params.chapterId,
        courseId: params.courseId,
        position: params.position,
      },
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data: courseChapter, error: null };
}
