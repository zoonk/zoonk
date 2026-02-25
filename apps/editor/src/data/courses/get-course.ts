import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Course, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

const cachedGetCourse = cache(
  async (
    courseSlug: string,
    orgSlug: string,
    headers?: Headers,
  ): Promise<SafeReturn<Course | null>> => {
    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers,
          orgSlug,
          permission: "update",
        }),
        prisma.course.findFirst({
          where: {
            organization: { slug: orgSlug },
            slug: courseSlug,
          },
        }),
      ]),
    );

    if (error) {
      return { data: null, error };
    }

    const [hasPermission, course] = data;

    if (!course) {
      return { data: null, error: null };
    }

    if (!hasPermission) {
      return { data: null, error: new AppError(ErrorCode.forbidden) };
    }

    return { data: course, error: null };
  },
);

export function getCourse(params: {
  courseSlug: string;
  orgSlug: string;
  headers?: Headers;
}): Promise<SafeReturn<Course | null>> {
  return cachedGetCourse(params.courseSlug, params.orgSlug, params.headers);
}
