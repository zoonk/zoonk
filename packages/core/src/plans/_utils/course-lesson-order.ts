import { type CourseLevel } from "@zoonk/db";
import {
  type CourseOutlineChapter,
  getCoursePlanOutline,
} from "../../goals/_utils/course-plan-graph";
import { type PlannerLesson } from "../planner/plan-units";

export function withCourseLessonOrder({
  chapters,
  lessons,
  levels: savedLevels,
  startChapterId,
}: {
  chapters: readonly CourseOutlineChapter[];
  lessons: readonly PlannerLesson[];
  levels?: readonly CourseLevel[];
  startChapterId: string | null;
}): PlannerLesson[] {
  const { chapters: planned, levels: currentLevels } = getCoursePlanOutline({
    chapters,
    startChapterId,
  });

  const levels = savedLevels ?? currentLevels;

  const placements = planned.flatMap((chapter) =>
    chapter.lessonIds.map((lessonId) => ({
      band: chapter.level,
      chapterId: chapter.chapterId,
      lessonId,
      phase: levels.indexOf(chapter.level),
    })),
  );

  const order = new Map(
    placements
      .map((placement, position) => [placement.lessonId, { ...placement, position }] as const)
      .toReversed(),
  );

  const includedChapters = new Set(planned.map((chapter) => chapter.chapterId));

  const excluded = new Set(
    chapters
      .filter((chapter) => !includedChapters.has(chapter.chapterId))
      .flatMap((chapter) => chapter.lessonIds),
  );

  const placed = lessons
    .filter((lesson) => !excluded.has(lesson.lessonId) || order.has(lesson.lessonId))
    .map((lesson) => {
      const placement = order.get(lesson.lessonId);

      if (placement && placement.phase < 0) {
        return lesson;
      }

      return placement
        ? {
            ...lesson,
            band: placement.band,
            chapterId: placement.chapterId,
            courseOrder: { phase: placement.phase, position: placement.position },
          }
        : lesson;
    });

  const outlined = placed
    .filter((lesson) => lesson.courseOrder)
    .toSorted((a, b) => (a.courseOrder?.position ?? 0) - (b.courseOrder?.position ?? 0))
    .values();

  return placed.map((lesson) => (lesson.courseOrder ? (outlined.next().value ?? lesson) : lesson));
}
