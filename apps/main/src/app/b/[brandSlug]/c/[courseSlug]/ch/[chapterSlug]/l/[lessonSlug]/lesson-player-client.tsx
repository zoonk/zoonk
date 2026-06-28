"use client";

import {
  trackChapterCompleted,
  trackLessonCompleted,
  trackLessonSecondStep,
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
import { getPlayerViewer } from "./get-player-viewer";
import { type LessonProgressMeta, buildLessonPlayerModel } from "./lesson-player-model";
import { preloadNextLesson } from "./preload-next-lesson-action";
import { submitCompletion } from "./submit-completion-action";
import { useTrackLessonStarted } from "./use-track-lesson-started";

type LessonPlayerClientProps = {
  lesson: SerializedLesson;
  brandSlug: string;
  chapterPosition: number;
  chapterTitle: string;
  courseTitle: string;
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
  courseTitle,
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
    lessonSlug,
    nextChapter,
    nextLesson,
  });

  const onNextHref = model.onNextHref;
  const handleNext = onNextHref ? () => router.push(onNextHref) : undefined;

  useEffect(() => {
    hasRequestedNextLessonPreload.current = false;
    hasTrackedSecondStep.current = false;
  }, [lesson.id]);

  useTrackLessonStarted({ chapterPosition, courseSlug, lesson, lessonPosition, lessonSlug });

  const handleComplete = useCallback(
    (input: CompletionInput) => {
      trackLessonCompleted({
        chapterPosition,
        courseSlug,
        lessonKind: lesson.kind,
        lessonPosition,
        lessonSlug,
      });

      if (model.milestone) {
        trackChapterCompleted({ chapterPosition, chapterSlug, courseSlug });
      }

      if (!isAuthenticated) {
        return;
      }

      void submitCompletion(input);
    },
    [
      chapterPosition,
      chapterSlug,
      courseSlug,
      isAuthenticated,
      lesson.kind,
      lessonPosition,
      lessonSlug,
      model.milestone,
    ],
  );

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
      courseTitle={courseTitle}
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
      viewer={getPlayerViewer({
        chapterSlug,
        courseSlug,
        isAuthenticated,
        lessonSlug,
        userEmail,
        userName,
      })}
    >
      <PlayerShell />
    </PlayerProvider>
  );
}
