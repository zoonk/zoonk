import { randomUUID } from "node:crypto";
import { type Lesson, type LessonProgress, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";

function lessonAttrs(
  attrs?: Partial<Lesson> & { lessonId?: string },
): Omit<Lesson, "id" | "createdAt" | "updatedAt"> {
  const title = attrs?.title ?? "Test Lesson";
  const normalizedTitle = attrs?.normalizedTitle ?? normalizeString(title);

  return {
    chapterId: attrs?.chapterId ?? "",
    description: attrs?.description ?? "Test lesson description",
    generationRunId: null,
    generationStatus: "completed",
    imageUrl: null,
    isLocked: false,
    isPublished: false,
    kind: "explanation",
    language: "en",
    normalizedTitle,
    organizationId: null,
    position: 0,
    slug: `test-lesson-${randomUUID()}`,
    title,
    ...attrs,
  };
}

async function getChapterIdFromLesson(lessonId?: string) {
  if (!lessonId) {
    return;
  }

  const lesson = await prisma.lesson.findUnique({
    select: { chapterId: true },
    where: { id: lessonId },
  });

  return lesson?.chapterId;
}

export async function lessonFixture(attrs?: Partial<Lesson> & { lessonId?: string }) {
  const chapterId = attrs?.chapterId ?? (await getChapterIdFromLesson(attrs?.lessonId));
  const { lessonId: _lessonId, ...input } = attrs ?? {};
  const lesson = await prisma.lesson.create({ data: lessonAttrs({ ...input, chapterId }) });

  return lesson;
}

/**
 * Existing fixture callers provide completion timestamps, so their UTC date is
 * a sensible default while timezone-boundary tests can pass an exact local day.
 */
function getLessonProgressCompletedDate({
  completedAt,
  completedDate,
}: {
  completedAt: Date | null;
  completedDate?: Date | null;
}): Date | null {
  if (completedDate !== undefined) {
    return completedDate;
  }

  if (!completedAt) {
    return null;
  }

  return new Date(
    Date.UTC(completedAt.getUTCFullYear(), completedAt.getUTCMonth(), completedAt.getUTCDate()),
  );
}

export async function lessonProgressFixture(
  attrs: Omit<LessonProgress, "completedDate" | "id" | "startedAt" | "lessonId"> & {
    completedDate?: Date | null;
    lessonId?: string;
    startedAt?: Date;
  },
) {
  const lessonProgress = await prisma.lessonProgress.create({
    data: {
      completedAt: attrs.completedAt,
      completedDate: getLessonProgressCompletedDate(attrs),
      durationSeconds: attrs.durationSeconds,
      lessonId: attrs.lessonId ?? "",
      startedAt: attrs.startedAt,
      userId: attrs.userId,
    },
  });

  return lessonProgress;
}
