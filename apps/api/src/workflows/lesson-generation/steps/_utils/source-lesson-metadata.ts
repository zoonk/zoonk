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
 * Converts ordered planned lesson rows into prompt metadata. Generation status
 * is intentionally ignored because titles and descriptions define scope before
 * generated content exists.
 */
export function getSourceLessonMetadataList(
  lessons: { description: string | null; title: string | null }[],
): SourceLessonMetadata[] {
  return lessons.flatMap((lesson) => sourceLessonForPrompt(lesson));
}
