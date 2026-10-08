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
  _count: { select: { chapters: true, steps: { where: { retiredAt: null } } } },
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
 * Screens carry the content's provenance (the lesson row's own provenance is its outline), so the
 * model and prompt version filters match lessons with a screen written by them. Only the current
 * version's screens count; a version a check replaced stays a day for learners playing it.
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

    return { lessons, total };
  },
);

export type ListedLibraryLesson = Awaited<ReturnType<typeof listLibraryLessons>>["lessons"][number];

/**
 * The Library view of `/lessons`: shared lessons with where they live (home chapter and course),
 * how far their writing got, and which model and prompt version wrote their screens.
 */
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
