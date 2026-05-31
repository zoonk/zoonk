import { type LessonKind, prisma } from "@zoonk/db";
import { type LessonContext } from "../get-lesson-step";
import { getSourceLessonMetadataInRange } from "./source-lesson-metadata";

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
 * Practice and quiz generation use explanation lesson metadata that has not
 * already fed the previous lesson of the same kind. This keeps generation
 * independent from explanation content while preserving the same source range.
 */
export async function getSourceLessonsSinceLastLessonKind({
  context,
  kind,
}: {
  context: LessonContext;
  kind: Extract<LessonKind, "practice" | "quiz">;
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
