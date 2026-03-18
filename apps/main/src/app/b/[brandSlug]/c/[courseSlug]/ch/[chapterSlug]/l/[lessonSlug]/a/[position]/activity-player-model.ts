import { type Route } from "next";

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

function route<Href extends string>(href: Route<Href>): Route<Href> {
  return href;
}

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
  const lessonHref = route(`/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}`);
  const chapterHref = route(`/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}`);
  const courseHref = route(`/b/${brandSlug}/c/${courseSlug}`);

  const nextActivityHref = nextActivity
    ? route(
        `/b/${brandSlug}/c/${courseSlug}/ch/${nextActivity.chapterSlug}/l/${nextActivity.lessonSlug}/a/${String(nextActivity.activityPosition)}`,
      )
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
      return route(
        `/b/${brandSlug}/c/${courseSlug}/ch/${nextActivity.chapterSlug}/l/${nextActivity.lessonSlug}`,
      );
    }

    if (nextSibling) {
      return route(
        `/b/${nextSibling.brandSlug}/c/${nextSibling.courseSlug}/ch/${nextSibling.chapterSlug}/l/${nextSibling.lessonSlug}`,
      );
    }

    return null;
  })();

  const nextChapterHref = (() => {
    if (nextActivity && nextActivity.chapterSlug !== chapterSlug) {
      return route(`/b/${brandSlug}/c/${courseSlug}/ch/${nextActivity.chapterSlug}`);
    }

    if (nextSibling && nextSibling.chapterSlug !== chapterSlug) {
      return route(
        `/b/${nextSibling.brandSlug}/c/${nextSibling.courseSlug}/ch/${nextSibling.chapterSlug}`,
      );
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
      levelHref: route("/level"),
      loginHref: route("/login"),
      nextActivityHref,
    },
    onNextHref: nextActivityHref ?? nextLessonHref,
  };
}
