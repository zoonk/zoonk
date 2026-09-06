"use client";

import {
  trackChapterCompleted,
  trackLessonCompleted,
  trackLessonSecondStep,
} from "@/lib/track-events";
import { type CompletionInput } from "@zoonk/core/player/contracts/completion-input-schema";
import { type SerializedLesson } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { type PlayerStepChangeEvent } from "@zoonk/player/provider";
import { useCallback, useEffect, useRef } from "react";
import { preloadNextLesson } from "./preload-next-lesson-action";
import { submitCompletion } from "./submit-completion-action";
import { useTrackLessonStarted } from "./use-track-lesson-started";

/** Identifies the first forward transition that proves the learner engaged beyond step one. */
function isSecondStepForwardEvent(event: PlayerStepChangeEvent) {
  return event.direction === "next" && event.previousStepIndex === 0 && event.nextStepIndex === 1;
}

export function useLessonPlayerHandlers({
  chapterPosition,
  chapterSlug,
  courseSlug,
  hasMilestone,
  isAuthenticated,
  lesson,
  lessonPosition,
  lessonSlug,
}: {
  chapterPosition: number;
  chapterSlug: string;
  courseSlug: string;
  hasMilestone: boolean;
  isAuthenticated: boolean;
  lesson: SerializedLesson;
  lessonPosition: number;
  lessonSlug: string;
}) {
  const hasRequestedNextLessonPreload = useRef(false);
  const hasTrackedSecondStep = useRef(false);

  useEffect(() => {
    hasRequestedNextLessonPreload.current = false;
    hasTrackedSecondStep.current = false;
  }, [lesson.id]);

  useTrackLessonStarted({
    chapterPosition,
    courseSlug,
    isAuthenticated,
    lesson,
    lessonPosition,
    lessonSlug,
  });

  const handleComplete = useCallback(
    (input: CompletionInput) => {
      trackLessonCompleted({
        chapterPosition,
        courseSlug,
        lessonKind: lesson.kind,
        lessonPosition,
        lessonSlug,
      });

      if (hasMilestone) {
        trackChapterCompleted({ chapterPosition, chapterSlug, courseSlug });
      }

      if (isAuthenticated) {
        void submitCompletion(input);
      }
    },
    [
      chapterPosition,
      chapterSlug,
      courseSlug,
      hasMilestone,
      isAuthenticated,
      lesson.kind,
      lessonPosition,
      lessonSlug,
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

  return { handleComplete, handleStepChange };
}
