"use client";

import { getLessonAgainHref } from "@/lib/public/public-hrefs";
import {
  type CompletedLesson,
  type CompletedLessonFilter,
} from "@zoonk/core/completed-lessons/contract";
import { type CompletedLessonsHrefs, CompletedLessonsScreen } from "@zoonk/learn/completed-lessons";
import { useSearchParams } from "next/navigation";

const PAGE = "/completed-lessons";

const HREFS: CompletedLessonsHrefs = {
  back: "/today",
  group: (key) => (key ? `${PAGE}?${new URLSearchParams({ group: key })}` : PAGE),
  lesson: (lessonId) => getLessonAgainHref({ lessonId, origin: PAGE }),
};

export function CompletedLessonsClient({
  filter,
  lessons,
}: {
  filter: CompletedLessonFilter | null;
  lessons: CompletedLesson[];
}) {
  const group = useSearchParams().get("group");

  return <CompletedLessonsScreen filter={filter} group={group} hrefs={HREFS} lessons={lessons} />;
}
