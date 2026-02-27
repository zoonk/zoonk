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
  nextActivity,
  userName,
}: {
  activity: SerializedActivity;
  brandSlug: string;
  courseSlug: string;
  chapterSlug: string;
  isAuthenticated: boolean;
  lessonSlug: string;
  nextActivity: { chapterSlug: string; lessonSlug: string; activityPosition: number } | null;
  userName: string | null;
}) {
  const router = useRouter();

  const lessonHref = `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}` as const;

  const nextActivityHref = nextActivity
    ? (`/b/${brandSlug}/c/${courseSlug}/ch/${nextActivity.chapterSlug}/l/${nextActivity.lessonSlug}/a/${String(nextActivity.activityPosition)}` as const)
    : null;

  return (
    <PlayerProvider
      activity={activity}
      isAuthenticated={isAuthenticated}
      completionFooter={
        <ContentFeedback
          className="pt-8"
          contentId={activity.id}
          kind="activity"
          variant="minimal"
        />
      }
      lessonHref={lessonHref}
      levelHref="/level"
      loginHref="/login"
      nextActivityHref={nextActivityHref}
      onComplete={submitCompletion}
      onEscape={() => router.push(lessonHref)}
      onNext={nextActivityHref ? () => router.push(nextActivityHref) : undefined}
      userName={userName}
    >
      <PlayerShell />
    </PlayerProvider>
  );
}
