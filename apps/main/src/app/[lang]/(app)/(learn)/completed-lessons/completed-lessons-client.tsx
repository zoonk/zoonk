"use client";

import { getLessonAgainHref } from "@/lib/public/public-hrefs";
import { saveLessonIn } from "@/lib/saved-lessons/save-lesson";
import {
  type CompletedLesson,
  type CompletedLessonFilter,
} from "@zoonk/core/completed-lessons/contract";
import { type CompletedLessonsHrefs, CompletedLessonsScreen } from "@zoonk/learn/completed-lessons";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

const PAGE = "/completed-lessons";

const HREFS: CompletedLessonsHrefs = {
  back: "/today",
  group: (key) => (key ? `${PAGE}?${new URLSearchParams({ group: key })}` : PAGE),
  lesson: (lessonId) => getLessonAgainHref({ lessonId, origin: PAGE }),
};

export function CompletedLessonsClient({
  filter,
  goalId,
  lessons,
}: {
  filter: CompletedLessonFilter | null;
  goalId: string;
  lessons: CompletedLesson[];
}) {
  const group = useSearchParams().get("group");
  const save = useMemo(() => saveLessonIn(goalId), [goalId]);

  return (
    <CompletedLessonsScreen
      filter={filter}
      group={group}
      hrefs={HREFS}
      lessons={lessons}
      save={save}
    />
  );
}
