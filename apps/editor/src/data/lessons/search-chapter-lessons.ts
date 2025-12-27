import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { prisma } from "@zoonk/db";
import { AppError, safeAsync } from "@zoonk/utils/error";
import { normalizeString } from "@zoonk/utils/string";
import { cache } from "react";
import { ErrorCode } from "@/lib/app-error";
import type { LessonWithPosition } from "./list-chapter-lessons";

export const searchChapterLessons = cache(
  async (params: {
    chapterSlug: string;
    headers?: Headers;
    orgSlug: string;
    title: string;
  }): Promise<{ data: LessonWithPosition[]; error: Error | null }> => {
    const { title, chapterSlug, orgSlug } = params;
    const normalizedSearch = normalizeString(title);

    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers: params.headers,
          orgSlug,
          permission: "update",
        }),
        prisma.chapterLesson.findMany({
          include: { lesson: true },
          orderBy: { position: "asc" },
          where: {
            chapter: {
              organization: { slug: orgSlug },
              slug: chapterSlug,
            },
            lesson: {
              normalizedTitle: {
                contains: normalizedSearch,
                mode: "insensitive",
              },
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
