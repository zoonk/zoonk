import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Lesson, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

const cachedGetLesson = cache(
  async (
    chapterSlug: string,
    courseSlug: string,
    lessonSlug: string,
    orgSlug: string,
    headers?: Headers,
  ): Promise<SafeReturn<Lesson | null>> => {
    const { data: lesson, error: findError } = await safeAsync(() =>
      prisma.lesson.findFirst({
        where: {
          chapter: {
            course: { slug: courseSlug },
            slug: chapterSlug,
          },
          organization: { slug: orgSlug },
          slug: lessonSlug,
        },
      }),
    );

    if (findError) {
      return { data: null, error: findError };
    }

    if (!lesson) {
      return { data: null, error: null };
    }

    const hasPermission = await hasCoursePermission({
      headers,
      orgId: lesson.organizationId,
      permission: "update",
    });

    if (!hasPermission) {
      return { data: null, error: new AppError(ErrorCode.forbidden) };
    }

    return { data: lesson, error: null };
  },
);

export function getLesson(params: {
  chapterSlug: string;
  courseSlug: string;
  headers?: Headers;
  lessonSlug: string;
  orgSlug: string;
}): Promise<SafeReturn<Lesson | null>> {
  return cachedGetLesson(
    params.chapterSlug,
    params.courseSlug,
    params.lessonSlug,
    params.orgSlug,
    params.headers,
  );
}
