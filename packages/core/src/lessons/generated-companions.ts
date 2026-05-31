import "server-only";
import { type Lesson, prisma } from "@zoonk/db";
import {
  getGeneratedCompanionSourceKind,
  getGeneratedCompanionTargetKind,
} from "./generated-companion-kinds";

export { isGeneratedCompanionLessonKind } from "./generated-companion-kinds";

type LessonCompanionCursor = Pick<Lesson, "chapterId" | "kind" | "position">;

type LessonCompanionLink = Pick<
  Lesson,
  "generationStatus" | "id" | "kind" | "position" | "slug" | "title"
>;

/**
 * Finds the source lesson that owns a generated companion row. The source does
 * not need completed content; callers use this to route learners to the lesson
 * generation page that can create the missing companion content.
 */
export async function getSourceLessonForGeneratedCompanion(
  lesson: LessonCompanionCursor,
): Promise<LessonCompanionLink | null> {
  const sourceKind = getGeneratedCompanionSourceKind(lesson.kind);

  if (!sourceKind) {
    return null;
  }

  return prisma.lesson.findFirst({
    orderBy: { position: "desc" },
    select: {
      generationStatus: true,
      id: true,
      kind: true,
      position: true,
      slug: true,
      title: true,
    },
    where: { chapterId: lesson.chapterId, kind: sourceKind, position: { lt: lesson.position } },
  });
}

/**
 * Finds the companion row owned by a source lesson. The upper bound prevents a
 * source row from claiming a companion that belongs to the next source row.
 */
export async function getGeneratedCompanionForSourceLesson(
  lesson: LessonCompanionCursor,
): Promise<LessonCompanionLink | null> {
  const targetKind = getGeneratedCompanionTargetKind(lesson.kind);

  if (!targetKind) {
    return null;
  }

  const nextSourceLesson = await prisma.lesson.findFirst({
    orderBy: { position: "asc" },
    select: { position: true },
    where: { chapterId: lesson.chapterId, kind: lesson.kind, position: { gt: lesson.position } },
  });

  return prisma.lesson.findFirst({
    orderBy: { position: "asc" },
    select: {
      generationStatus: true,
      id: true,
      kind: true,
      position: true,
      slug: true,
      title: true,
    },
    where: {
      chapterId: lesson.chapterId,
      kind: targetKind,
      position: {
        gt: lesson.position,
        ...(nextSourceLesson ? { lt: nextSourceLesson.position } : {}),
      },
    },
  });
}
