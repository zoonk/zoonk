"use client";

import { ContentFeedback } from "@/components/feedback/content-feedback";
import {
  trackLessonCompleted,
  trackLessonSecondStep,
  trackLessonStarted,
} from "@/lib/track-events";
import { type CompletionInput } from "@zoonk/core/player/contracts/completion-input-schema";
import { type SerializedLesson } from "@zoonk/core/player/contracts/prepare-lesson-data";
import {
  type PlayerProgressSnapshot,
  PlayerProvider,
  type PlayerStepChangeEvent,
} from "@zoonk/player/provider";
import { PlayerShell } from "@zoonk/player/shell";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { type LessonProgressMeta, buildLessonPlayerModel } from "./lesson-player-model";
import { preloadNextLesson } from "./preload-next-lesson-action";
import { submitCompletion } from "./submit-completion-action";

type LessonPlayerClientProps = {
  lesson: SerializedLesson;
  brandSlug: string;
  chapterPosition: number;
  chapterTitle: string;
  courseSlug: string;
  chapterSlug: string;
  isAuthenticated: boolean;
  lessonDescription: string;
  lessonProgress: LessonProgressMeta;
  lessonPosition: number;
  lessonSlug: string;
  lessonTitle: string;
  nextChapter: { brandSlug: string; chapterSlug: string; courseSlug: string } | null;
  nextLesson: { chapterSlug: string; lessonSlug: string; lessonTitle: string | null } | null;
  progressSnapshot: PlayerProgressSnapshot | null;
  totalBrainPower: number;
  userEmail?: string;
  userName: string | null;
};

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
  chapterPosition,
  chapterTitle,
  courseSlug,
  chapterSlug,
  isAuthenticated,
  lessonDescription,
  lessonProgress,
  lessonPosition,
  lessonSlug,
  lessonTitle,
  nextChapter,
  nextLesson,
  progressSnapshot,
  totalBrainPower,
  userEmail,
  userName,
}: LessonPlayerClientProps) {
  const router = useRouter();
  const hasRequestedNextLessonPreload = useRef(false);
  const hasTrackedSecondStep = useRef(false);

  const model = buildLessonPlayerModel({
    brandSlug,
    chapterSlug,
    courseSlug,
    lessonProgress,
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

    trackLessonStarted({
      chapterPosition,
      courseSlug,
      lessonKind: lesson.kind,
      lessonPosition,
      lessonSlug,
      stepCount: lesson.steps.length,
    });
  }, [
    chapterPosition,
    courseSlug,
    lesson.id,
    lesson.kind,
    lessonPosition,
    lessonSlug,
    lesson.steps.length,
  ]);

  /** Fire-and-forget: analytics runs for all learners; persistence requires auth. */
  const handleComplete = useCallback(
    (input: CompletionInput) => {
      trackLessonCompleted({
        chapterPosition,
        courseSlug,
        lessonKind: lesson.kind,
        lessonPosition,
        lessonSlug,
      });

      if (!isAuthenticated) {
        return;
      }

      void submitCompletion(input);
    },
    [chapterPosition, courseSlug, isAuthenticated, lesson.kind, lessonPosition, lessonSlug],
  );

  /** Fire once after the first forward step change; completion handles short lessons. */
  const handleStepChange = useCallback(
    (event: PlayerStepChangeEvent) => {
      if (isSecondStepForwardEvent(event) && !hasTrackedSecondStep.current) {
        hasTrackedSecondStep.current = true;

        trackLessonSecondStep({
          chapterPosition,
          courseSlug,
          lessonKind: lesson.kind,
          lessonPosition,
          lessonSlug,
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
    [
      chapterPosition,
      courseSlug,
      isAuthenticated,
      lesson.kind,
      lessonPosition,
      lessonSlug,
      lesson.steps.length,
    ],
  );

  return (
    <PlayerProvider
      lesson={lesson}
      chapterTitle={chapterTitle}
      lessonDescription={lessonDescription}
      lessonProgress={model.lessonProgress}
      lessonTitle={lessonTitle}
      milestone={model.milestone}
      navigation={model.navigation}
      onComplete={handleComplete}
      onEscape={() => router.push(model.navigation.chapterHref)}
      onNext={handleNext}
      onStepChange={handleStepChange}
      progressSnapshot={progressSnapshot}
      totalBrainPower={totalBrainPower}
      viewer={{
        completionFooter: (
          <ContentFeedback
            className="pt-8"
            defaultEmail={userEmail}
            feedbackTarget={{ chapterSlug, courseSlug, kind: "lesson", lessonSlug }}
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
