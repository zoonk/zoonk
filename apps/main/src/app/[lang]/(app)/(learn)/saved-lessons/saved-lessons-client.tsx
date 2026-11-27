"use client";

import { readLearnerSummaryAgain } from "@/lib/learner/learner-store";
import { getLessonAgainHref } from "@/lib/public/public-hrefs";
import { saveLessonIn } from "@/lib/saved-lessons/save-lesson";
import { type SavedLesson } from "@zoonk/core/saved-lessons/contract";
import { type SavedLessonsHrefs, SavedLessonsScreen } from "@zoonk/learn/saved-lessons";
import { useLayoutEffect, useMemo, useRef } from "react";

const PAGE = "/saved-lessons";

const HREFS: SavedLessonsHrefs = {
  back: "/today",
  lesson: (lessonId) => getLessonAgainHref({ lessonId, origin: PAGE }),
};

/**
 * The sidebar keeps listing this page while the learner is on it, as its bar does, so removing the
 * last save here takes the place away only once they leave (when Next hides the page).
 */
function usePlacesReadOnLeave() {
  const saved = useRef(false);

  useLayoutEffect(
    () => () => {
      if (saved.current) {
        saved.current = false;
        readLearnerSummaryAgain();
      }
    },
    [],
  );

  return () => {
    saved.current = true;
  };
}

export function SavedLessonsClient({
  goalId,
  lessons,
}: {
  goalId: string;
  lessons: SavedLesson[];
}) {
  const onSaved = usePlacesReadOnLeave();
  const save = useMemo(() => saveLessonIn(goalId, onSaved), [goalId, onSaved]);
  return <SavedLessonsScreen hrefs={HREFS} lessons={lessons} save={save} />;
}
