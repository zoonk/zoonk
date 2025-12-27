import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Lesson, prisma } from "@zoonk/db";
import { AppError, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";
import { ErrorCode } from "@/lib/app-error";

export type LessonWithPosition = Lesson & {
  position: number;
};

export const listChapterLessons = cache(
  async (params: {
    chapterSlug: string;
    headers?: Headers;
    orgSlug: string;
  }): Promise<{ data: LessonWithPosition[]; error: Error | null }> => {
    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers: params.headers,
          orgSlug: params.orgSlug,
          permission: "update",
        }),
        prisma.chapterLesson.findMany({
          include: { lesson: true },
          orderBy: { position: "asc" },
          where: {
            chapter: {
              organization: { slug: params.orgSlug },
              slug: params.chapterSlug,
            },
          },
        }),
      ]),
    );

    if (error) {
      return { data: [], error };
    }

    const [hasPermission, chapterLessons] = data;

    if (!hasPermission) {
      return { data: [], error: new AppError(ErrorCode.forbidden) };
    }

    const lessons = chapterLessons.map((cl) => ({
      ...cl.lesson,
      position: cl.position,
    }));

    return { data: lessons, error: null };
  },
);
