type NextLesson = { chapterSlug: string; lessonSlug: string; lessonTitle: string | null };
type NextChapter = { brandSlug: string; chapterSlug: string; courseSlug: string };

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
  nextChapter: NextChapter | null;
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
  nextChapter = null,
  nextLesson,
}: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  nextChapter?: NextChapter | null;
  nextLesson: NextLesson | null;
}) {
  const chapterHref = `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}` as const;
  const courseHref = `/b/${brandSlug}/c/${courseSlug}` as const;
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
    milestone,
    navigation: {
      chapterHref,
      courseHref,
      levelHref: "/level",
      loginHref: "/login",
      nextLessonHref,
    },
    onNextHref: nextLessonHref ?? nextChapterHref,
  };
}
