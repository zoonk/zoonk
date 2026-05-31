import { type LessonKind, prisma } from "@zoonk/db";

export type SourceLessonMetadata = { description: string; title: string };

/**
 * Source lesson metadata is optional because companion lessons can have empty
 * titles and descriptions. Skipping empty rows prevents prompt input like `:`
 * while still allowing pending planned lessons to define generation scope.
 */
function sourceLessonForPrompt(lesson: {
  description: string | null;
  title: string | null;
}): SourceLessonMetadata[] {
  if (!lesson.title && !lesson.description) {
    return [];
  }

  return [{ description: lesson.description ?? "", title: lesson.title ?? "" }];
}

/**
 * Returns prompt-ready metadata for planned source lessons in a structural
 * range. Generation status is intentionally ignored because generated lessons
 * can use title and description before the source content itself exists.
 */
export async function getSourceLessonMetadataInRange({
  afterPosition,
  beforePosition,
  chapterId,
  kinds,
}: {
  afterPosition: number;
  beforePosition: number;
  chapterId: string;
  kinds: LessonKind[];
}): Promise<SourceLessonMetadata[]> {
  const lessons = await prisma.lesson.findMany({
    orderBy: { position: "asc" },
    where: { chapterId, kind: { in: kinds }, position: { gt: afterPosition, lt: beforePosition } },
  });

  return lessons.flatMap((lesson) => sourceLessonForPrompt(lesson));
}
