import "server-only";

import { getSession } from "@zoonk/core/users/session/get";
import { type CourseUser, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { ErrorCode } from "@/lib/app-error";

export async function addCourseUser(params: {
  courseId: number;
  headers?: Headers;
}): Promise<SafeReturn<CourseUser>> {
  const session = await getSession({ headers: params.headers });

  if (!session) {
    return { data: null, error: new AppError(ErrorCode.unauthorized) };
  }

  const userId = Number(session.user.id);

  const { data, error } = await safeAsync(() =>
    prisma.courseUser.upsert({
      create: {
        courseId: params.courseId,
        userId,
      },
      update: {},
      where: {
        courseUser: {
          courseId: params.courseId,
          userId,
        },
      },
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}
