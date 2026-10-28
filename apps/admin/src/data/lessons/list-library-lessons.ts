import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { type LibraryLessonStatus, toContentStatus } from "@/lib/library-lesson-filters";
import { prisma } from "@zoonk/db";

type LibraryLessonFilter = {
  model?: string;
  promptVersion?: string;
  search?: string;
  status: LibraryLessonStatus;
};

const libraryLessonListInclude = {
  homeChapter: {
    select: { homeCourse: { select: { id: true, title: true } }, id: true, title: true },
  },
  steps: {
    orderBy: { position: "asc" as const },
    select: { generatedAt: true, model: true, promptVersion: true, runId: true },
    take: 1,
    where: { retiredAt: null },
  },
} as const;

/**
 * Screens carry the content's provenance (the lesson row's own is its outline), so the model and
 * prompt filters match lessons by their current screens.
 */
function buildLibraryLessonWhere({ model, promptVersion, search, status }: LibraryLessonFilter) {
  const containsSearch = search ? { contains: search, mode: "insensitive" as const } : undefined;
  const hasProvenanceFilter = Boolean(model ?? promptVersion);

  return {
    contentStatus: toContentStatus(status),
    ...(hasProvenanceFilter ? { steps: { some: { model, promptVersion, retiredAt: null } } } : {}),
    ...(containsSearch
      ? {
          OR: [
            { title: containsSearch },
            { homeChapter: { title: containsSearch } },
            { homeChapter: { homeCourse: { title: containsSearch } } },
          ],
        }
      : {}),
  };
}

/** A relation `_count` would count every lesson's rows, not only the page's. */
async function countLessonRows(lessonIds: string[]) {
  const [chapters, steps] = await Promise.all([
    prisma.chapterLesson.groupBy({
      _count: { chapterId: true },
      by: ["lessonId"],
      where: { lessonId: { in: lessonIds } },
    }),
    prisma.step.groupBy({
      _count: { id: true },
      by: ["lessonId"],
      where: { lessonId: { in: lessonIds }, retiredAt: null },
    }),
  ]);

  const chaptersByLesson = new Map(chapters.map((row) => [row.lessonId, row._count.chapterId]));
  const stepsByLesson = new Map(steps.map((row) => [row.lessonId, row._count.id]));

  return (lessonId: string) => ({
    chapters: chaptersByLesson.get(lessonId) ?? 0,
    steps: stepsByLesson.get(lessonId) ?? 0,
  });
}

const cachedListLibraryLessons = cacheAdminData(
  async (
    limit: number,
    offset: number,
    status: LibraryLessonStatus,
    search?: string,
    model?: string,
    promptVersion?: string,
  ) => {
    const where = buildLibraryLessonWhere({ model, promptVersion, search, status });

    const [lessons, total] = await Promise.all([
      prisma.lesson.findMany({
        include: libraryLessonListInclude,
        omit: { spec: true, summary: true },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: offset,
        take: limit,
        where,
      }),
      prisma.lesson.count({ where }),
    ]);

    const counts = await countLessonRows(lessons.map((lesson) => lesson.id));

    return { lessons: lessons.map((lesson) => ({ ...lesson, _count: counts(lesson.id) })), total };
  },
);

export type ListedLibraryLesson = Awaited<ReturnType<typeof listLibraryLessons>>["lessons"][number];

export async function listLibraryLessons({
  limit,
  model,
  offset,
  promptVersion,
  search,
  status,
}: LibraryLessonFilter & { limit: number; offset: number }) {
  return cachedListLibraryLessons(limit, offset, status, search, model, promptVersion);
}
