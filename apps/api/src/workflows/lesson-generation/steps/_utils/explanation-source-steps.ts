import { prisma } from "@zoonk/db";
import { type LessonContext } from "../get-lesson-step";
import { getSourceLessonMetadata } from "./source-lesson-metadata";

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
 * Practice and quiz lessons are planned directly after the explanation they
 * assess. Using the nearest previous explanation keeps generation 1:1 instead
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
