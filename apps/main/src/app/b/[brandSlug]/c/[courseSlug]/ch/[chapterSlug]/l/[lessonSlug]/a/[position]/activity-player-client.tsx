"use client";

import { ContentFeedback } from "@/components/feedback/content-feedback";
import { type SerializedActivity } from "@zoonk/player/prepare-activity-data";
import { PlayerProvider } from "@zoonk/player/provider";
import { PlayerShell } from "@zoonk/player/shell";
import { useRouter } from "next/navigation";
import { buildActivityPlayerModel } from "./activity-player-model";
import { submitCompletion } from "./submit-completion-action";

export function ActivityPlayerClient({
  activity,
  brandSlug,
  courseSlug,
  chapterSlug,
  isAuthenticated,
  lessonSlug,
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
  const model = buildActivityPlayerModel({
    brandSlug,
    chapterSlug,
    courseSlug,
    lessonSlug,
    nextActivity,
    nextSibling,
  });
  const onNextHref = model.onNextHref;
  const handleNext = onNextHref ? () => router.push(onNextHref) : undefined;

  return (
    <PlayerProvider
      activity={activity}
      milestone={model.milestone}
      navigation={model.navigation}
      onComplete={submitCompletion}
      onEscape={() => router.push(model.navigation.lessonHref)}
      onNext={handleNext}
      viewer={{
        completionFooter: (
          <ContentFeedback
            className="pt-8"
            contentId={activity.id}
            defaultEmail={userEmail}
            kind="activity"
            variant="minimal"
          />
        ),
        isAuthenticated,
        userName,
      }}
    >
      <PlayerShell />
    </PlayerProvider>
  );
}
