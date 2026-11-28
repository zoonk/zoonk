import { type DaySegmentState } from "../today/day-segments";

type Chapter = { done: number; lessons: number; skipped: number; start: boolean };

export type CourseSegment = { share: number; state: DaySegmentState; weight: number };

/**
 * A chapter's fill is everything behind the learner, studied (`done`) or skipped by the test, so
 * the line reads as one run up to the chapter they start in.
 */
export function toCourseSegments(chapters: readonly Chapter[]): CourseSegment[] {
  return chapters.map((chapter) => {
    const behind = Math.min(chapter.lessons, chapter.done + chapter.skipped);
    const whole = chapter.lessons > 0 && behind === chapter.lessons;
    const state = whole ? "done" : "ahead";

    return {
      share: whole || chapter.lessons === 0 ? 0 : behind / chapter.lessons,
      state: chapter.start ? "current" : state,
      weight: chapter.lessons,
    };
  });
}
