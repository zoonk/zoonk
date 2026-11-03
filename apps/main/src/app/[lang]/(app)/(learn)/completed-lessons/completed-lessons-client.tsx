"use client";

import { getLessonAgainHref } from "@/lib/public/public-hrefs";
import { type CompletedLesson } from "@zoonk/core/completed-lessons/contract";
import { type CompletedLessonsHrefs, CompletedLessonsScreen } from "@zoonk/learn/completed-lessons";

const HREFS: CompletedLessonsHrefs = {
  back: "/today",
  lesson: (lessonId) => getLessonAgainHref({ lessonId, origin: "/completed-lessons" }),
};

export function CompletedLessonsClient({
  goalTitle,
  lessons,
  moreHref,
  today,
}: {
  goalTitle: string;
  lessons: CompletedLesson[];
  moreHref: string | null;
  today: string;
}) {
  return (
    <CompletedLessonsScreen
      goalTitle={goalTitle}
      hrefs={HREFS}
      lessons={lessons}
      moreHref={moreHref}
      today={today}
    />
  );
}
