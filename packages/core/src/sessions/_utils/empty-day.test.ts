import { describe, expect, it } from "vitest";
import { hasLessonRoom } from "./empty-day";

const DAY = { dailyMinutes: 30, freshStart: null };

describe(hasLessonRoom, () => {
  it("holds room for the rest of the plan's day", () => {
    expect(hasLessonRoom({ day: DAY, limitMinutes: null, plannedMinutes: 20 })).toBe(true);
    expect(hasLessonRoom({ day: DAY, limitMinutes: null, plannedMinutes: 28 })).toBe(false);
  });

  it("holds no room past the learner's daily time limit", () => {
    expect(hasLessonRoom({ day: DAY, limitMinutes: 20, plannedMinutes: 20 })).toBe(false);
  });

  it("holds no room past a welcome back's light day, unless it's an exam eve's full review", () => {
    const welcomeBack = { ...DAY, freshStart: "welcomeBack" as const };

    expect(hasLessonRoom({ day: welcomeBack, limitMinutes: null, plannedMinutes: 15 })).toBe(false);

    expect(
      hasLessonRoom({
        day: { ...welcomeBack, fullReviewSkillIds: ["skill"] },
        limitMinutes: null,
        plannedMinutes: 15,
      }),
    ).toBe(true);
  });
});
