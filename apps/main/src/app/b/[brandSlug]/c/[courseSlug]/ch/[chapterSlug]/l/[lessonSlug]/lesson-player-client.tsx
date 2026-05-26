"use client";

import { ContentFeedback } from "@/components/feedback/content-feedback";
import { trackLessonCompleted, trackPlayerLoaded, trackPlayerSecondStep } from "@/lib/track-events";
import { type CompletionInput } from "@zoonk/core/player/contracts/completion-input-schema";
import { type SerializedLesson } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { PlayerProvider, type PlayerStepChangeEvent } from "@zoonk/player/provider";
import { PlayerShell } from "@zoonk/player/shell";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { buildLessonPlayerModel } from "./lesson-player-model";
import { preloadNextLesson } from "./preload-next-lesson-action";
import { submitCompletion } from "./submit-completion-action";

/**
 * Identifies the exact funnel moment where a learner has advanced from the
 * first player step to the second, regardless of whether the first step was
 * static or interactive.
 */
function isSecondStepForwardEvent(event: PlayerStepChangeEvent) {
  return event.direction === "next" && event.previousStepIndex === 0 && event.nextStepIndex === 1;
}

export function LessonPlayerClient({
  lesson,
  brandSlug,
  chapterTitle,
  courseSlug,
  chapterSlug,
  isAuthenticated,
  lessonDescription,
  lessonTitle,
  nextChapter,
  nextLesson,
  totalBrainPower,
  userEmail,
  userName,
}: {
  lesson: SerializedLesson;
  brandSlug: string;
  chapterTitle: string;
  courseSlug: string;
  chapterSlug: string;
  isAuthenticated: boolean;
  lessonDescription: string;
  lessonTitle: string;
  nextChapter: { brandSlug: string; chapterSlug: string; courseSlug: string } | null;
  nextLesson: { chapterSlug: string; lessonSlug: string; lessonTitle: string | null } | null;
  totalBrainPower: number;
  userEmail?: string;
  userName: string | null;
}) {
  const router = useRouter();
  const hasRequestedNextLessonPreload = useRef(false);
  const hasTrackedSecondStep = useRef(false);

  const model = buildLessonPlayerModel({
    brandSlug,
    chapterSlug,
    courseSlug,
    nextChapter,
    nextLesson,
  });

  const onNextHref = model.onNextHref;
  const handleNext = onNextHref ? () => router.push(onNextHref) : undefined;

  useEffect(() => {
    hasRequestedNextLessonPreload.current = false;
    hasTrackedSecondStep.current = false;
  }, [lesson.id]);

  useEffect(() => {
    if (lesson.steps.length === 0) {
      return;
    }

    trackPlayerLoaded({
      lessonId: lesson.id,
      lessonKind: lesson.kind,
      stepCount: lesson.steps.length,
    });
  }, [lesson.id, lesson.kind, lesson.steps.length]);

  /** Fire-and-forget: analytics runs for all learners; persistence requires auth. */
  const handleComplete = useCallback(
    (input: CompletionInput) => {
      trackLessonCompleted({
        lessonId: input.lessonId,
        lessonKind: lesson.kind,
        startedAt: input.startedAt,
        stepCount: lesson.steps.length,
      });

      if (!isAuthenticated) {
        return;
      }

      void submitCompletion(input);
    },
    [isAuthenticated, lesson.kind, lesson.steps.length],
  );

  /** Fire once after the first forward step change; completion handles short lessons. */
  const handleStepChange = useCallback(
    (event: PlayerStepChangeEvent) => {
      if (isSecondStepForwardEvent(event) && !hasTrackedSecondStep.current) {
        hasTrackedSecondStep.current = true;

        trackPlayerSecondStep({
          lessonId: event.lessonId,
          lessonKind: lesson.kind,
          stepCount: lesson.steps.length,
        });
      }

      if (
        !isAuthenticated ||
        event.direction !== "next" ||
        event.previousStepIndex !== 0 ||
        hasRequestedNextLessonPreload.current
      ) {
        return;
      }

      hasRequestedNextLessonPreload.current = true;
      void preloadNextLesson(event.lessonId);
    },
    [isAuthenticated, lesson.kind, lesson.steps.length],
  );

  return (
    <PlayerProvider
      lesson={lesson}
      chapterTitle={chapterTitle}
      lessonDescription={lessonDescription}
      lessonTitle={lessonTitle}
      milestone={model.milestone}
      navigation={model.navigation}
      onComplete={handleComplete}
      onEscape={() => router.push(model.navigation.chapterHref)}
      onNext={handleNext}
      onStepChange={handleStepChange}
      totalBrainPower={totalBrainPower}
      viewer={{
        completionFooter: (
          <ContentFeedback
            className="pt-8"
            contentId={lesson.id}
            defaultEmail={userEmail}
            kind="lesson"
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
