"use client";

import { ContentFeedback } from "@/components/feedback/content-feedback";
import { type CompletionInput } from "@zoonk/core/player/contracts/completion-input-schema";
import { type SerializedActivity } from "@zoonk/core/player/contracts/prepare-activity-data";
import { PlayerProvider } from "@zoonk/player/provider";
import { PlayerShell } from "@zoonk/player/shell";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
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
  totalBrainPower,
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
  totalBrainPower: number;
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

  /** Fire-and-forget: the server validates and persists via `after()`. */
  const handleComplete = useCallback((input: CompletionInput) => {
    void submitCompletion(input);
  }, []);

  return (
    <PlayerProvider
      activity={activity}
      milestone={model.milestone}
      navigation={model.navigation}
      onComplete={handleComplete}
      onEscape={() => router.push(model.navigation.lessonHref)}
      onNext={handleNext}
      totalBrainPower={totalBrainPower}
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
