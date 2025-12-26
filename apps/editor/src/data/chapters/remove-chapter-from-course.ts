import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type CourseChapter, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";

export async function removeChapterFromCourse(params: {
  chapterId: number;
  courseId: number;
  headers?: Headers;
}): Promise<SafeReturn<CourseChapter>> {
  const { data: courseChapter, error: findError } = await safeAsync(() =>
    prisma.courseChapter.findUnique({
      include: { course: true },
      where: {
        courseChapter: {
          chapterId: params.chapterId,
          courseId: params.courseId,
        },
      },
    }),
  );

  if (findError) {
    return { data: null, error: findError };
  }

  if (!courseChapter) {
    return { data: null, error: new Error("Chapter not found in course") };
  }

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: courseChapter.course.organizationId,
    permission: "update",
  });

  if (!hasPermission) {
    return { data: null, error: new Error("Forbidden") };
  }

  const { error } = await safeAsync(() =>
    prisma.courseChapter.delete({
      where: { id: courseChapter.id },
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data: courseChapter, error: null };
}
