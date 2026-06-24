import { type LessonKind, prisma } from "@zoonk/db";
import { type LessonContext } from "../get-lesson-step";
import { getSourceLessonMetadata, getSourceLessonMetadataInRange } from "./source-lesson-metadata";

/**
 * Sibling titles are optional prompt context. Untitled structural lessons
 * should not appear as `"null"` or placeholder text in explanation prompts.
 */
function lessonTitleForPrompt(lesson: { title: string | null }): string[] {
  return lesson.title ? [lesson.title] : [];
}

export async function getOtherExplanationLessonTitles(context: LessonContext): Promise<string[]> {
  const lessons = await prisma.lesson.findMany({
    orderBy: { position: "asc" },
    where: { chapterId: context.chapterId, id: { not: context.id }, kind: "explanation" },
  });

  return lessons.flatMap((lesson) => lessonTitleForPrompt(lesson));
}

/**
 * Practice lessons are planned directly after the explanation they assess.
 * Using the nearest previous explanation keeps practice generation 1:1 instead
 * of inheriting the older multi-explanation range behavior.
 */
export async function getPreviousExplanationSourceLesson(context: LessonContext) {
  const lesson = await prisma.lesson.findFirst({
    orderBy: { position: "desc" },
    where: {
      chapterId: context.chapterId,
      kind: "explanation",
      position: { lt: context.position },
    },
  });

  return lesson ? getSourceLessonMetadata(lesson) : null;
}

/**
 * Quiz generation covers explanation metadata that has not already fed the
 * previous quiz. Practice uses a separate 1:1 helper because each practice row
 * is planned directly after its source explanation.
 */
export async function getSourceLessonsSinceLastLessonKind({
  context,
  kind,
}: {
  context: LessonContext;
  kind: Extract<LessonKind, "quiz">;
}) {
  const previousLesson = await prisma.lesson.findFirst({
    orderBy: { position: "desc" },
    where: { chapterId: context.chapterId, kind, position: { lt: context.position } },
  });

  return getSourceLessonMetadataInRange({
    afterPosition: previousLesson?.position ?? -1,
    beforePosition: context.position,
    chapterId: context.chapterId,
    kinds: ["explanation"],
  });
}
