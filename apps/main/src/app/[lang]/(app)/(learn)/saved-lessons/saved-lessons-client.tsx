"use client";

import { readLearnerSummaryAgain } from "@/lib/learner/learner-store";
import { getLessonAgainHref } from "@/lib/public/public-hrefs";
import { placesReadOnLeave } from "@/lib/saved-lessons/places-read-on-leave";
import { saveLessonIn } from "@/lib/saved-lessons/save-lesson";
import { type SavedLesson } from "@zoonk/core/saved-lessons/contract";
import { type SavedLessonsHrefs, SavedLessonsScreen } from "@zoonk/learn/saved-lessons";
import { useLayoutEffect, useMemo, useState } from "react";

const PAGE = "/saved-lessons";

const HREFS: SavedLessonsHrefs = {
  back: "/today",
  lesson: (lessonId) => getLessonAgainHref({ lessonId, origin: PAGE }),
};

/** The last save removed here takes the place away once the learner leaves. */
function usePlacesReadOnLeave() {
  // oxlint-disable-next-line react/hook-use-state -- Made once and never replaced, so there is no setter.
  const [places] = useState(() => placesReadOnLeave(readLearnerSummaryAgain));

  useLayoutEffect(() => {
    places.show();
    return places.leave;
  }, [places]);

  return places.saved;
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
