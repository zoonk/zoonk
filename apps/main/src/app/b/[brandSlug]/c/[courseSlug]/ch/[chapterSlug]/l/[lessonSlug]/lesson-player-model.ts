type NextLesson = {
  chapterSlug: string;
  lessonSlug: string;
  lessonTitle: string | null;
};

type NextSibling = {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  lessonSlug: string;
  lessonTitle: string;
};

export function buildLessonPlayerModel({
  brandSlug,
  chapterSlug,
  courseSlug,
  nextLesson,
  nextSibling,
}: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  nextLesson: NextLesson | null;
  nextSibling: NextSibling | null;
}) {
  const chapterHref = `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}` as const;
  const courseHref = `/b/${brandSlug}/c/${courseSlug}` as const;

  const nextLessonHref = nextLesson
    ? (`/b/${brandSlug}/c/${courseSlug}/ch/${nextLesson.chapterSlug}/l/${nextLesson.lessonSlug}` as const)
    : null;

  const nextLessonShellHref = (() => {
    if (nextLesson) {
      return `/b/${brandSlug}/c/${courseSlug}/ch/${nextLesson.chapterSlug}/l/${nextLesson.lessonSlug}` as const;
    }

    if (nextSibling) {
      return `/b/${nextSibling.brandSlug}/c/${nextSibling.courseSlug}/ch/${nextSibling.chapterSlug}/l/${nextSibling.lessonSlug}` as const;
    }

    return null;
  })();

  const nextChapterHref = (() => {
    if (nextLesson && nextLesson.chapterSlug !== chapterSlug) {
      return `/b/${brandSlug}/c/${courseSlug}/ch/${nextLesson.chapterSlug}`;
    }

    if (nextSibling && nextSibling.chapterSlug !== chapterSlug) {
      return `/b/${nextSibling.brandSlug}/c/${nextSibling.courseSlug}/ch/${nextSibling.chapterSlug}`;
    }

    return null;
  })();

  const milestone = (() => {
    if (!nextLesson && !nextSibling) {
      return {
        kind: "course" as const,
        reviewHref: courseHref,
        secondaryReviewHref: chapterHref,
      };
    }

    if (nextChapterHref) {
      return {
        kind: "chapter" as const,
        nextHref: nextChapterHref,
        reviewHref: chapterHref,
      };
    }

    return null;
  })();

  return {
    milestone,
    navigation: {
      chapterHref,
      courseHref,
      lessonHref: chapterHref,
      levelHref: "/level",
      loginHref: "/login",
      nextLessonHref,
    },
    onNextHref: nextLessonHref ?? nextLessonShellHref,
  };
}
