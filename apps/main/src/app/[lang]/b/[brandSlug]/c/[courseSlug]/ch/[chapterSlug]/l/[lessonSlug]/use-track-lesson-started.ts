"use client";

import { trackLessonStarted } from "@/lib/track-events";
import { type SerializedLesson } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { startTransition, useEffect } from "react";
import { recordLessonStart } from "./start-lesson-action";

type LessonStartedTrackingInput = {
  chapterPosition: number;
  courseSlug: string;
  isAuthenticated: boolean;
  lesson: SerializedLesson;
  lessonPosition: number;
  lessonSlug: string;
};

/**
 * Synchronizes a mounted playable lesson with external analytics and persisted
 * progress. This must run after mount so route prefetching remains read-only.
 */
export function useTrackLessonStarted({
  chapterPosition,
  courseSlug,
  isAuthenticated,
  lesson,
  lessonPosition,
  lessonSlug,
}: LessonStartedTrackingInput) {
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

    if (isAuthenticated) {
      startTransition(() => {
        void recordLessonStart(lesson.id);
      });
    }
  }, [
    chapterPosition,
    courseSlug,
    isAuthenticated,
    lesson.id,
    lesson.kind,
    lessonPosition,
    lessonSlug,
    lesson.steps.length,
  ]);
}
