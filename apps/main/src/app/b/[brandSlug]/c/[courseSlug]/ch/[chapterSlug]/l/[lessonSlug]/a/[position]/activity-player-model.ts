type NextActivity = {
  activityPosition: number;
  chapterSlug: string;
  lessonSlug: string;
  lessonTitle: string;
};

type NextSibling = {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  lessonSlug: string;
  lessonTitle: string;
};

export function buildActivityPlayerModel({
  brandSlug,
  chapterSlug,
  courseSlug,
  lessonSlug,
  nextActivity,
  nextSibling,
}: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  lessonSlug: string;
  nextActivity: NextActivity | null;
  nextSibling: NextSibling | null;
}) {
  const lessonHref = `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}` as const;
  const chapterHref = `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}`;
  const courseHref = `/b/${brandSlug}/c/${courseSlug}`;

  const nextActivityHref = nextActivity
    ? (`/b/${brandSlug}/c/${courseSlug}/ch/${nextActivity.chapterSlug}/l/${nextActivity.lessonSlug}/a/${String(nextActivity.activityPosition)}` as const)
    : null;

  const isLastInLesson =
    !nextActivity ||
    nextActivity.lessonSlug !== lessonSlug ||
    nextActivity.chapterSlug !== chapterSlug;

  const nextLessonHref = (() => {
    if (!isLastInLesson) {
      return null;
    }

    if (nextActivity) {
      return `/b/${brandSlug}/c/${courseSlug}/ch/${nextActivity.chapterSlug}/l/${nextActivity.lessonSlug}` as const;
    }

    if (nextSibling) {
      return `/b/${nextSibling.brandSlug}/c/${nextSibling.courseSlug}/ch/${nextSibling.chapterSlug}/l/${nextSibling.lessonSlug}` as const;
    }

    return null;
  })();

  const nextChapterHref = (() => {
    if (nextActivity && nextActivity.chapterSlug !== chapterSlug) {
      return `/b/${brandSlug}/c/${courseSlug}/ch/${nextActivity.chapterSlug}`;
    }

    if (nextSibling && nextSibling.chapterSlug !== chapterSlug) {
      return `/b/${nextSibling.brandSlug}/c/${nextSibling.courseSlug}/ch/${nextSibling.chapterSlug}`;
    }

    return null;
  })();

  const milestone = (() => {
    if (!isLastInLesson) {
      return { kind: "activity" as const };
    }

    if (!nextActivity && !nextSibling) {
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

    return {
      kind: "lesson" as const,
      nextHref: nextLessonHref,
      reviewHref: lessonHref,
    };
  })();

  return {
    milestone,
    navigation: {
      chapterHref,
      courseHref,
      lessonHref,
      levelHref: "/level",
      loginHref: "/login",
      nextActivityHref,
    },
    onNextHref: nextActivityHref ?? nextLessonHref,
  };
}
