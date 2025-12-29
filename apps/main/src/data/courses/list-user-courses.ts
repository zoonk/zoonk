import "server-only";

import { getSession } from "@zoonk/core/users/session/get";
import { type Course, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { AppError, type SafeReturn } from "@zoonk/utils/error";
import { cache } from "react";
import { ErrorCode } from "@/lib/app-error";

const LIST_USER_COURSES_LIMIT = 20;

export const listUserCourses = cache(
  async (params?: {
    headers?: Headers;
    limit?: number;
  }): Promise<SafeReturn<Course[]>> => {
    const session = await getSession({ headers: params?.headers });

    if (!session) {
      return { data: null, error: new AppError(ErrorCode.unauthorized) };
    }

    const userId = Number(session.user.id);

    const courseUsers = await prisma.courseUser.findMany({
      include: { course: true },
      orderBy: { startedAt: "desc" },
      take: clampQueryItems(params?.limit ?? LIST_USER_COURSES_LIMIT),
      where: { userId },
    });

    const courses = courseUsers.map((cu) => cu.course);

    return { data: courses, error: null };
  },
);
