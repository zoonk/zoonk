"use client";

import { trackLessonStarted } from "@/lib/track-events";
import { type SerializedLesson } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { useEffect } from "react";

type LessonStartedTrackingInput = {
  chapterPosition: number;
  courseSlug: string;
  lesson: SerializedLesson;
  lessonPosition: number;
  lessonSlug: string;
};

/**
 * Counts the lesson-start funnel event when a playable lesson mounts. The
 * effect synchronizes the mounted player screen with external analytics.
 */
export function useTrackLessonStarted({
  chapterPosition,
  courseSlug,
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
  }, [
    chapterPosition,
    courseSlug,
    lesson.id,
    lesson.kind,
    lessonPosition,
    lessonSlug,
    lesson.steps.length,
  ]);
}
