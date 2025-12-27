import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Lesson, prisma } from "@zoonk/db";
import { AppError, safeAsync } from "@zoonk/utils/error";
import { normalizeString } from "@zoonk/utils/string";
import { cache } from "react";
import { ErrorCode } from "@/lib/app-error";

export type LessonWithChapters = Lesson & {
  chapters: { slug: string }[];
};

export const searchOrgLessons = cache(
  async (params: {
    headers?: Headers;
    orgSlug: string;
    title: string;
  }): Promise<{ data: LessonWithChapters[]; error: Error | null }> => {
    const { title, orgSlug } = params;
    const normalizedSearch = normalizeString(title);

    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers: params.headers,
          orgSlug,
          permission: "update",
        }),
        prisma.lesson.findMany({
          include: {
            chapterLessons: {
              select: {
                chapter: { select: { slug: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          where: {
            normalizedTitle: {
              contains: normalizedSearch,
              mode: "insensitive",
            },
            organization: { slug: orgSlug },
          },
        }),
      ]),
    );

    if (error) {
      return { data: [], error };
    }

    const [hasPermission, lessons] = data;

    if (!hasPermission) {
      return { data: [], error: new AppError(ErrorCode.forbidden) };
    }

    const lessonsWithChapters = lessons.map(
      ({ chapterLessons, ...lesson }) => ({
        ...lesson,
        chapters: chapterLessons.map((cl) => cl.chapter),
      }),
    );

    return { data: lessonsWithChapters, error: null };
  },
);
