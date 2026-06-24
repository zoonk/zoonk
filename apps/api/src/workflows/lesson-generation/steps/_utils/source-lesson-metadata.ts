import { type LessonKind, prisma } from "@zoonk/db";

export type SourceLessonMetadata = { description: string; title: string };

/**
 * Normalizes planned lesson metadata for prompts while skipping empty companion
 * rows that do not define a real source scope. Pending lessons can still define
 * scope through title and description before generated content exists.
 */
export function getSourceLessonMetadata(lesson: {
  description: string | null;
  title: string | null;
}): SourceLessonMetadata | null {
  if (!lesson.title && !lesson.description) {
    return null;
  }

  return { description: lesson.description ?? "", title: lesson.title ?? "" };
}

/**
 * Range-based prompts need arrays, so this adapts one row into zero or one
 * prompt-ready metadata item.
 */
function sourceLessonForPrompt(lesson: {
  description: string | null;
  title: string | null;
}): SourceLessonMetadata[] {
  const metadata = getSourceLessonMetadata(lesson);
  return metadata ? [metadata] : [];
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
