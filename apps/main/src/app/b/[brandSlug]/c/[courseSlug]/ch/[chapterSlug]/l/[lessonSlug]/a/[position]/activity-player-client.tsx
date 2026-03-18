"use client";

import { ContentFeedback } from "@/components/feedback/content-feedback";
import { type SerializedActivity } from "@zoonk/player/prepare-activity-data";
import { PlayerProvider } from "@zoonk/player/provider";
import { PlayerShell } from "@zoonk/player/shell";
import { useRouter } from "next/navigation";
import { submitCompletion } from "./submit-completion-action";

export function ActivityPlayerClient({
  activity,
  brandSlug,
  courseSlug,
  chapterSlug,
  isAuthenticated,
  lessonSlug,
  lessonTitle,
  nextActivity,
  nextSibling,
  userEmail,
  userName,
}: {
  activity: SerializedActivity;
  brandSlug: string;
  courseSlug: string;
  chapterSlug: string;
  isAuthenticated: boolean;
  lessonSlug: string;
  lessonTitle: string;
  nextActivity: {
    chapterSlug: string;
    lessonSlug: string;
    lessonTitle: string;
    activityPosition: number;
  } | null;
  nextSibling: {
    brandSlug: string;
    chapterSlug: string;
    courseSlug: string;
    lessonSlug: string;
    lessonTitle: string;
  } | null;
  userEmail?: string;
  userName: string | null;
}) {
  const router = useRouter();

  const lessonHref = `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}` as const;

  const nextActivityHref = nextActivity
    ? (`/b/${brandSlug}/c/${courseSlug}/ch/${nextActivity.chapterSlug}/l/${nextActivity.lessonSlug}/a/${String(nextActivity.activityPosition)}` as const)
    : null;

  const isLastInLesson = !nextActivity || nextActivity.lessonSlug !== lessonSlug;

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

  const isNextChapter = (() => {
    if (nextActivity) {
      return nextActivity.chapterSlug !== chapterSlug;
    }

    if (nextSibling) {
      return nextSibling.chapterSlug !== chapterSlug;
    }

    return false;
  })();

  const nextLessonTitle = (() => {
    if (!isLastInLesson) {
      return null;
    }

    if (nextActivity) {
      return nextActivity.lessonTitle;
    }

    if (nextSibling) {
      return nextSibling.lessonTitle;
    }

    return null;
  })();

  const chapterHref = `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}` as const;
  const courseHref = `/b/${brandSlug}/c/${courseSlug}` as const;
  const isCourseComplete = isLastInLesson && !nextActivity && !nextSibling;

  const nextChapterHref = (() => {
    if (!isNextChapter) {
      return null;
    }

    if (nextActivity) {
      return `/b/${brandSlug}/c/${courseSlug}/ch/${nextActivity.chapterSlug}` as const;
    }

    if (nextSibling) {
      return `/b/${nextSibling.brandSlug}/c/${nextSibling.courseSlug}/ch/${nextSibling.chapterSlug}` as const;
    }

    return null;
  })();

  const onNextHref = nextActivityHref ?? nextLessonHref;

  return (
    <PlayerProvider
      activity={activity}
      isAuthenticated={isAuthenticated}
      isLastInLesson={isLastInLesson}
      isCourseComplete={isCourseComplete}
      isNextChapter={isNextChapter}
      chapterHref={chapterHref}
      courseHref={courseHref}
      completionFooter={
        <ContentFeedback
          className="pt-8"
          contentId={activity.id}
          defaultEmail={userEmail}
          kind="activity"
          variant="minimal"
        />
      }
      lessonHref={lessonHref}
      lessonTitle={lessonTitle}
      levelHref="/level"
      loginHref="/login"
      nextActivityHref={nextActivityHref}
      nextChapterHref={nextChapterHref}
      nextLessonHref={nextLessonHref}
      nextLessonTitle={nextLessonTitle}
      onComplete={submitCompletion}
      onEscape={() => router.push(lessonHref)}
      onNext={onNextHref ? () => router.push(onNextHref) : undefined}
      userName={userName}
    >
      <PlayerShell />
    </PlayerProvider>
  );
}
