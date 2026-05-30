const FREE_UNAUTHENTICATED_FIRST_CHAPTER_LESSON_COUNT = 5;
const FREE_AUTHENTICATED_FIRST_CHAPTER_LESSON_COUNT = 10;

export type LessonAccessRequirement = "authentication" | "free" | "subscription";

type LessonAccessInput = { chapter: { position: number }; position: number };

/**
 * The product treats the first chapter as the only free preview area. Keeping
 * this check named makes every caller use the same zero-based chapter rule
 * instead of repeating `position === 0` with slightly different meanings.
 */
function isFirstChapterLesson({ lesson }: { lesson: LessonAccessInput }): boolean {
  return lesson.chapter.position === 0;
}

/**
 * Anonymous learners get a smaller preview than signed-in learners. This helper
 * keeps the two limits explicit so route gates can decide whether a blocked
 * request needs login or a paid subscription.
 */
function getFreeFirstChapterLessonCount({ isAuthenticated }: { isAuthenticated: boolean }): number {
  return isAuthenticated
    ? FREE_AUTHENTICATED_FIRST_CHAPTER_LESSON_COUNT
    : FREE_UNAUTHENTICATED_FIRST_CHAPTER_LESSON_COUNT;
}

/**
 * Lesson gates need three outcomes, not a boolean. Lessons 6-10 in the first
 * chapter are free after login, while lesson 11+ and every later chapter lesson
 * require a subscription even when content has already been generated.
 */
export function getLessonAccessRequirement({
  isAuthenticated,
  lesson,
}: {
  isAuthenticated: boolean;
  lesson: LessonAccessInput;
}): LessonAccessRequirement {
  if (!isFirstChapterLesson({ lesson })) {
    return "subscription";
  }

  if (lesson.position < FREE_UNAUTHENTICATED_FIRST_CHAPTER_LESSON_COUNT) {
    return "free";
  }

  if (lesson.position < getFreeFirstChapterLessonCount({ isAuthenticated })) {
    return "free";
  }

  if (lesson.position < FREE_AUTHENTICATED_FIRST_CHAPTER_LESSON_COUNT) {
    return "authentication";
  }

  return "subscription";
}
