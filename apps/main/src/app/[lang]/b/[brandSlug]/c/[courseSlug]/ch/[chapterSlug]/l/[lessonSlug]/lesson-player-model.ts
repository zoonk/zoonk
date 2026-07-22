type NextLesson = { chapterSlug: string; lessonSlug: string; lessonTitle: string | null };
type OrderedItem = { id: string };
type OrderedChapter = OrderedItem & { slug: string };

export type NextChapterTarget = { brandSlug: string; chapterSlug: string; courseSlug: string };

export type LessonProgressMeta = {
  currentLessonNumber: number;
  remainingChaptersInCourse: number;
  remainingLessonsInChapter: number;
  totalLessonsInChapter: number;
};

const DEFAULT_LESSON_PROGRESS: LessonProgressMeta = {
  currentLessonNumber: 1,
  remainingChaptersInCourse: 0,
  remainingLessonsInChapter: 0,
  totalLessonsInChapter: 1,
};

/**
 * Selects the next published chapter from the ordered course outline already
 * loaded by the lesson page. This keeps structural selection pure and avoids a
 * second database query for data that is already available to the caller.
 */
export function getNextChapterTarget({
  brandSlug,
  chapterId,
  courseChapters,
  courseSlug,
}: {
  brandSlug: string;
  chapterId: string;
  courseChapters: readonly OrderedChapter[];
  courseSlug: string;
}): NextChapterTarget | null {
  const chapterIndex = courseChapters.findIndex((chapter) => chapter.id === chapterId);
  const nextChapter = courseChapters[chapterIndex + 1];

  if (chapterIndex === -1 || !nextChapter) {
    return null;
  }

  return { brandSlug, chapterSlug: nextChapter.slug, courseSlug };
}

/**
 * Converts an ordered curriculum list into the human position learners expect.
 * Database positions can have gaps when unpublished rows are hidden, so the UI
 * should count visible published items instead of showing raw stored positions.
 */
function getHumanPosition({
  currentId,
  items,
}: {
  currentId: string;
  items: readonly OrderedItem[];
}) {
  const index = items.findIndex((item) => item.id === currentId);

  if (index === -1) {
    return 1;
  }

  return index + 1;
}

/**
 * Counts what remains after the current published item in the visible sequence.
 * If the current row is missing from a stale list, returning zero avoids
 * overstating unfinished work on the completion screen.
 */
function getRemainingItemCount({
  currentId,
  items,
}: {
  currentId: string;
  items: readonly OrderedItem[];
}) {
  const index = items.findIndex((item) => item.id === currentId);

  if (index === -1) {
    return 0;
  }

  return Math.max(items.length - index - 1, 0);
}

/**
 * Builds the small progress facts the player needs without exposing raw
 * curriculum rows to the client. The header needs lesson X of Y, while the
 * completion screen needs the remaining count for the next curriculum boundary.
 */
export function buildLessonProgressMeta({
  chapterId,
  chapterLessons,
  courseChapters,
  lessonId,
}: {
  chapterId: string;
  chapterLessons: readonly OrderedItem[];
  courseChapters: readonly OrderedItem[];
  lessonId: string;
}): LessonProgressMeta {
  const currentLessonNumber = getHumanPosition({ currentId: lessonId, items: chapterLessons });
  const totalLessonsInChapter = Math.max(chapterLessons.length, currentLessonNumber);

  return {
    currentLessonNumber,
    remainingChaptersInCourse: getRemainingItemCount({
      currentId: chapterId,
      items: courseChapters,
    }),
    remainingLessonsInChapter: getRemainingItemCount({
      currentId: lessonId,
      items: chapterLessons,
    }),
    totalLessonsInChapter,
  };
}

/**
 * The next playable lesson is only available after generation has created a
 * lesson shell. Keep this separate from chapter progression so an empty next
 * chapter does not look like the whole course is complete.
 */
function getNextLessonHref({
  brandSlug,
  courseSlug,
  nextLesson,
}: {
  brandSlug: string;
  courseSlug: string;
  nextLesson: NextLesson | null;
}) {
  if (!nextLesson) {
    return null;
  }

  return `/b/${brandSlug}/c/${courseSlug}/ch/${nextLesson.chapterSlug}/l/${nextLesson.lessonSlug}` as const;
}

/**
 * Builds the current player URL once so guest auth links can return learners
 * to the exact lesson where they chose to log in. The callback only accepts
 * app-relative paths, so this helper intentionally returns a path instead of
 * an absolute URL.
 */
function getCurrentLessonHref({
  brandSlug,
  chapterSlug,
  courseSlug,
  lessonSlug,
}: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  lessonSlug: string;
}) {
  return `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}` as const;
}

/**
 * Encodes the current lesson into the login route so central-auth redirects
 * can come back to the player instead of dropping learners on the home page.
 */
function getLoginHref({ currentLessonHref }: { currentLessonHref: string }) {
  return `/login?next=${encodeURIComponent(currentLessonHref)}` as const;
}

/**
 * Chapter completion is a structural boundary, not proof that the next lesson
 * is ready. A next chapter with no lessons should still show the chapter
 * milestone and send learners to the chapter page, where generation can start.
 */
function getNextChapterHref({
  brandSlug,
  chapterSlug,
  courseSlug,
  nextChapter,
  nextLesson,
}: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  nextChapter: NextChapterTarget | null;
  nextLesson: NextLesson | null;
}) {
  if (nextLesson?.chapterSlug === chapterSlug) {
    return null;
  }

  if (nextChapter) {
    return `/b/${nextChapter.brandSlug}/c/${nextChapter.courseSlug}/ch/${nextChapter.chapterSlug}` as const;
  }

  if (nextLesson) {
    return `/b/${brandSlug}/c/${courseSlug}/ch/${nextLesson.chapterSlug}` as const;
  }

  return null;
}

/**
 * Builds the player route model from course structure. The screen should only
 * say "Course Complete" when there is no later published chapter, even if the
 * next chapter has not generated a lesson yet.
 */
export function buildLessonPlayerModel({
  brandSlug,
  chapterSlug,
  courseSlug,
  lessonSlug,
  lessonProgress = DEFAULT_LESSON_PROGRESS,
  nextChapter = null,
  nextLesson,
}: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  lessonSlug: string;
  lessonProgress?: LessonProgressMeta;
  nextChapter?: NextChapterTarget | null;
  nextLesson: NextLesson | null;
}) {
  const chapterHref = `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}` as const;
  const courseHref = `/b/${brandSlug}/c/${courseSlug}` as const;

  const currentLessonHref = getCurrentLessonHref({
    brandSlug,
    chapterSlug,
    courseSlug,
    lessonSlug,
  });

  const nextLessonHref = getNextLessonHref({ brandSlug, courseSlug, nextLesson });

  const nextChapterHref = getNextChapterHref({
    brandSlug,
    chapterSlug,
    courseSlug,
    nextChapter,
    nextLesson,
  });

  const milestone = (() => {
    if (nextChapterHref) {
      return { kind: "chapter" as const, nextHref: nextChapterHref, reviewHref: chapterHref };
    }

    if (!nextLesson) {
      return { kind: "course" as const, reviewHref: courseHref, secondaryReviewHref: chapterHref };
    }

    return null;
  })();

  return {
    lessonProgress,
    milestone,
    navigation: {
      chapterHref,
      courseHref,
      energyHref: "/energy",
      levelHref: "/level",
      loginHref: getLoginHref({ currentLessonHref }),
      nextLessonHref,
      scoreHref: "/score",
    },
    onNextHref: nextLessonHref ?? nextChapterHref,
  };
}
