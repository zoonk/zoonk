"use client";

import {
  trackChapterCompleted,
  trackLessonCompleted,
  trackLessonSecondStep,
} from "@/lib/track-events";
import { type CourseLearningTarget } from "@zoonk/core/courses/learning-plan";
import { type CompletionInput } from "@zoonk/core/player/contracts/completion-input-schema";
import { type SerializedLesson } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { type PlayerCompletionOutcome, type PlayerStepChangeEvent } from "@zoonk/player/provider";
import { useCallback, useEffect, useRef, useState } from "react";
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
  courseId,
  isPrivate,
  isAuthenticated,
  lesson,
  lessonPosition,
  lessonSlug,
}: {
  chapterPosition: number;
  chapterSlug: string;
  courseSlug: string;
  courseId: string;
  isPrivate: boolean;
  isAuthenticated: boolean;
  lesson: SerializedLesson;
  lessonPosition: number;
  lessonSlug: string;
}) {
  const hasRequestedNextLessonPreload = useRef(false);
  const hasTrackedSecondStep = useRef(false);
  const [isSuperseded, setIsSuperseded] = useState(false);
  const [completionMilestone, setCompletionMilestone] = useState<"chapter" | "course" | null>(null);

  const [completionNextTarget, setCompletionNextTarget] = useState<CourseLearningTarget | null>(
    null,
  );

  useEffect(() => {
    hasRequestedNextLessonPreload.current = false;
    hasTrackedSecondStep.current = false;
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- Reset per-lesson tracking and preloading when navigation changes the lesson.
  }, [lesson.id]);

  useTrackLessonStarted({
    chapterPosition,
    courseSlug,
    isAuthenticated,
    isPrivate,
    lesson,
    lessonPosition,
    lessonSlug,
  });

  const handleComplete = useCallback(
    async (input: CompletionInput): Promise<PlayerCompletionOutcome> => {
      const outcome = isAuthenticated
        ? await submitCompletion(input, courseId)
        : { status: "completed" as const };

      if (outcome.status !== "completed") {
        if (outcome.status === "superseded") {
          setIsSuperseded(true);
        }

        return outcome;
      }

      if ("completionMilestone" in outcome) {
        setCompletionMilestone(outcome.completionMilestone);
        setCompletionNextTarget(outcome.nextTarget);
      }

      if (!isPrivate) {
        trackLessonCompleted({
          chapterPosition,
          courseSlug,
          lessonKind: lesson.kind,
          lessonPosition,
          lessonSlug,
        });

        if ("completionMilestone" in outcome && outcome.completionMilestone) {
          trackChapterCompleted({ chapterPosition, chapterSlug, courseSlug });
        }
      }

      return outcome;
    },
    [
      chapterPosition,
      chapterSlug,
      courseId,
      courseSlug,
      isAuthenticated,
      isPrivate,
      lesson.kind,
      lessonPosition,
      lessonSlug,
    ],
  );

  const handleStepChange = useCallback(
    (event: PlayerStepChangeEvent) => {
      if (!isPrivate && isSecondStepForwardEvent(event) && !hasTrackedSecondStep.current) {
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
      isPrivate,
      lesson.kind,
      lessonPosition,
      lessonSlug,
      lesson.steps.length,
    ],
  );

  return {
    completionMilestone,
    completionNextTarget,
    handleComplete,
    handleStepChange,
    isSuperseded,
  };
}
