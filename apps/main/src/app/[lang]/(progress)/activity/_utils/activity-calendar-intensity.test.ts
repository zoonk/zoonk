import { describe, expect, it } from "vitest";
import { getActivityCalendarIntensity } from "./activity-calendar-intensity";

describe(getActivityCalendarIntensity, () => {
  it.each([
    { expectedIntensity: 0, lessonCompletions: 0, maximumLessonCompletions: 10 },
    { expectedIntensity: 0, lessonCompletions: 0, maximumLessonCompletions: 0 },
    { expectedIntensity: 1, lessonCompletions: 1, maximumLessonCompletions: 10 },
    { expectedIntensity: 2, lessonCompletions: 5, maximumLessonCompletions: 10 },
    { expectedIntensity: 3, lessonCompletions: 6, maximumLessonCompletions: 10 },
    { expectedIntensity: 4, lessonCompletions: 10, maximumLessonCompletions: 10 },
  ])(
    "maps $lessonCompletions of $maximumLessonCompletions completions to level $expectedIntensity",
    ({ expectedIntensity, lessonCompletions, maximumLessonCompletions }) => {
      expect(getActivityCalendarIntensity({ lessonCompletions, maximumLessonCompletions })).toBe(
        expectedIntensity,
      );
    },
  );
});
