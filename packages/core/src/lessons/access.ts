export type LessonAccessRequirement = "free" | "subscription";

type LessonAccessInput = { chapter: { position: number } };

/**
 * The product treats the first chapter as the free plan area. Keeping
 * this check named makes every caller use the same zero-based chapter rule
 * instead of repeating `position === 0` with slightly different meanings.
 */
function isFirstChapterLesson({ lesson }: { lesson: LessonAccessInput }): boolean {
  return lesson.chapter.position === 0;
}

/**
 * Lesson gates need to enforce the chapter boundary, not lesson count. Every
 * lesson in the first chapter is part of the free plan, while later chapters
 * require a subscription even when content has already been generated.
 */
export function getLessonAccessRequirement({
  lesson,
}: {
  lesson: LessonAccessInput;
}): LessonAccessRequirement {
  if (!isFirstChapterLesson({ lesson })) {
    return "subscription";
  }

  return "free";
}
