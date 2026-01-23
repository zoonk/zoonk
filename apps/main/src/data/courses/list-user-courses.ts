import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { getSession } from "@zoonk/core/users/session/get";
import { type Course, type Organization, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

export type UserCourse = Course & { organization: Organization };

export const listUserCourses = cache(
  async (params?: { headers?: Headers }): Promise<SafeReturn<UserCourse[]>> => {
    const session = await getSession({ headers: params?.headers });

    if (!session) {
      return { data: null, error: new AppError(ErrorCode.unauthorized) };
    }

    const userId = Number(session.user.id);

    const { data, error } = await safeAsync(() =>
      prisma.courseUser.findMany({
        include: { course: { include: { organization: true } } },
        orderBy: { startedAt: "desc" },
        where: { userId },
      }),
    );

    if (error) {
      return { data: null, error };
    }

    const courses = data.map((cu) => cu.course);

    return { data: courses, error: null };
  },
);
