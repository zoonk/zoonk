import { type LessonKind, prisma } from "@zoonk/db";
import { type LessonContext } from "../get-lesson-step";

type SourceLesson = { description: string; title: string };

/**
 * Sibling titles are optional prompt context. Untitled structural lessons
 * should not appear as `"null"` or placeholder text in explanation prompts.
 */
function lessonTitleForPrompt(lesson: { title: string | null }): string[] {
  return lesson.title ? [lesson.title] : [];
}

/**
 * Practice and quiz prompts need lesson-level scope without every explanation step.
 * Empty metadata is skipped so the prompt does not receive placeholder rows
 * like `"null"` or `":"` when a source lesson has no usable summary.
 */
function sourceLessonForPrompt(lesson: { description: string | null; title: string | null }) {
  if (!lesson.title && !lesson.description) {
    return [];
  }

  return [{ description: lesson.description ?? "", title: lesson.title ?? "" }];
}

export async function getOtherExplanationLessonTitles(context: LessonContext): Promise<string[]> {
  const lessons = await prisma.lesson.findMany({
    orderBy: { position: "asc" },
    where: { chapterId: context.chapterId, id: { not: context.id }, kind: "explanation" },
  });

  return lessons.flatMap((lesson) => lessonTitleForPrompt(lesson));
}

/**
 * Practice and quiz generation should cover explanation lessons that have not
 * already fed the previous lesson of the same kind. Returning titles and
 * descriptions keeps prompts compact while preserving the same source range.
 */
export async function getSourceLessonsSinceLastLessonKind({
  context,
  kind,
}: {
  context: LessonContext;
  kind: Extract<LessonKind, "practice" | "quiz">;
}): Promise<SourceLesson[]> {
  const previousLesson = await prisma.lesson.findFirst({
    orderBy: { position: "desc" },
    where: { chapterId: context.chapterId, kind, position: { lt: context.position } },
  });

  return getSourceLessonsInRange({
    afterPosition: previousLesson?.position ?? -1,
    beforePosition: context.position,
    chapterId: context.chapterId,
  });
}

/**
 * Source lesson metadata is enough for practice and quiz scope and avoids
 * sending dozens of static explanation steps from production chapters into the
 * model context.
 */
async function getSourceLessonsInRange({
  afterPosition,
  beforePosition,
  chapterId,
}: {
  afterPosition: number;
  beforePosition: number;
  chapterId: string;
}): Promise<SourceLesson[]> {
  const lessons = await prisma.lesson.findMany({
    orderBy: { position: "asc" },
    where: {
      chapterId,
      generationStatus: "completed",
      kind: "explanation",
      position: { gt: afterPosition, lt: beforePosition },
    },
  });

  return lessons.flatMap((lesson) => sourceLessonForPrompt(lesson));
}
