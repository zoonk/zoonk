"use client";

import { getLessonAgainHref } from "@/lib/public/public-hrefs";
import { saveLessonIn } from "@/lib/saved-lessons/save-lesson";
import { useHoldSavedLessonsPlace } from "@/lib/saved-lessons/saved-lessons-place";
import { type SavedLesson } from "@zoonk/core/saved-lessons/contract";
import { type SavedLessonsHrefs, SavedLessonsScreen } from "@zoonk/learn/saved-lessons";
import { useMemo } from "react";

const PAGE = "/saved-lessons";

const HREFS: SavedLessonsHrefs = {
  back: "/today",
  lesson: (lessonId) => getLessonAgainHref({ lessonId, origin: PAGE }),
};

export function SavedLessonsClient({
  goalId,
  lessons,
}: {
  goalId: string;
  lessons: SavedLesson[];
}) {
  useHoldSavedLessonsPlace(lessons.length > 0);
  const save = useMemo(() => saveLessonIn(goalId), [goalId]);
  return <SavedLessonsScreen hrefs={HREFS} lessons={lessons} save={save} />;
}
