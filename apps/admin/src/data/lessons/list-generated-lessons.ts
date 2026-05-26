import "server-only";
import { isAdmin } from "@/lib/admin-guard";
import { type GeneratedLessonStatus } from "@/lib/generated-lesson-status";
import { prisma } from "@zoonk/db";
import { cache } from "react";

const cachedListGeneratedLessons = cache(
  async (limit: number, offset: number, status: GeneratedLessonStatus, search?: string) => {
    if (!(await isAdmin())) {
      return { lessons: [], total: 0 };
    }

    const where = buildGeneratedLessonWhere({ search, status });

    const [lessons, total] = await Promise.all([
      prisma.lesson.findMany({
        include: {
          _count: { select: { steps: true } },
          chapter: { include: { course: { include: { organization: true } } } },
        },
        orderBy: { updatedAt: "desc" },
        skip: offset,
        take: limit,
        where,
      }),
      prisma.lesson.count({ where }),
    ]);

    return { lessons, total };
  },
);

export type ListedGeneratedLesson = Awaited<
  ReturnType<typeof listGeneratedLessons>
>["lessons"][number];

/**
 * The generated lesson page uses named parameters while React cache keeps the
 * positional primitive arguments internally for stable memoization.
 */
export async function listGeneratedLessons({
  limit,
  offset,
  search,
  status,
}: {
  limit: number;
  offset: number;
  search?: string;
  status: GeneratedLessonStatus;
}) {
  return cachedListGeneratedLessons(limit, offset, status, search);
}

/**
 * Admins often investigate generation failures from partial context. Searching
 * lesson, chapter, and course titles keeps the log useful when a lesson title
 * is missing or too generic.
 */
function buildGeneratedLessonWhere({
  search,
  status,
}: {
  search?: string;
  status: GeneratedLessonStatus;
}) {
  if (!search) {
    return { generationStatus: status };
  }

  return {
    OR: [
      { normalizedTitle: { contains: search, mode: "insensitive" as const } },
      { chapter: { normalizedTitle: { contains: search, mode: "insensitive" as const } } },
      {
        chapter: {
          course: { normalizedTitle: { contains: search, mode: "insensitive" as const } },
        },
      },
    ],
    generationStatus: status,
  };
}
