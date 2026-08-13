import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { type GeneratedLessonFilter } from "@/lib/generated-lesson-status";
import { type LessonKind, prisma } from "@zoonk/db";
import { listMissingAudioLessonIds } from "./list-missing-audio-lesson-ids";

const aiGeneratedLessonKinds = [
  "alphabet",
  "explanation",
  "grammar",
  "practice",
  "quiz",
  "reading",
  "tutorial",
  "vocabulary",
] as const satisfies readonly LessonKind[];

const audioLessonKinds = [
  "alphabet",
  "reading",
  "vocabulary",
] as const satisfies readonly LessonKind[];

const cachedListGeneratedLessons = cacheAdminData(
  async (limit: number, offset: number, filter: GeneratedLessonFilter, search?: string) => {
    const missingAudioLessonIds =
      filter === "missingAudio" ? await listMissingAudioLessonIds() : [];

    const where = buildGeneratedLessonWhere({ filter, missingAudioLessonIds, search });

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
  filter,
  limit,
  offset,
  search,
}: {
  filter: GeneratedLessonFilter;
  limit: number;
  offset: number;
  search?: string;
}) {
  return cachedListGeneratedLessons(limit, offset, filter, search);
}

/**
 * Admins often investigate generation failures from partial context. Searching
 * lesson, chapter, and course titles keeps the log useful when a lesson title
 * is missing or too generic.
 */
function buildGeneratedLessonWhere({
  filter,
  missingAudioLessonIds,
  search,
}: {
  filter: GeneratedLessonFilter;
  missingAudioLessonIds: string[];
  search?: string;
}) {
  const baseWhere = getAiGeneratedLessonWhere({ filter, missingAudioLessonIds });

  if (!search) {
    return baseWhere;
  }

  return {
    ...baseWhere,
    OR: [
      { normalizedTitle: { contains: search, mode: "insensitive" as const } },
      { chapter: { normalizedTitle: { contains: search, mode: "insensitive" as const } } },
      {
        chapter: {
          course: { normalizedTitle: { contains: search, mode: "insensitive" as const } },
        },
      },
    ],
  };
}

/**
 * The generated lesson log should show lessons whose content was produced by
 * the AI workflow. Companion rows like review, translation, and listening reuse
 * existing generated resources, so including them makes the log look larger
 * than the set of lessons that actually went through model-authored generation.
 */
function getAiGeneratedLessonWhere({
  filter,
  missingAudioLessonIds,
}: {
  filter: GeneratedLessonFilter;
  missingAudioLessonIds: string[];
}) {
  if (filter === "missingAudio") {
    return {
      generationStatus: "completed" as const,
      id: { in: missingAudioLessonIds },
      kind: { in: [...audioLessonKinds] },
    };
  }

  return { generationStatus: filter, kind: { in: [...aiGeneratedLessonKinds] } };
}
