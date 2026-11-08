import { describe, expect, it } from "vitest";
import { hasLessonRoom } from "./empty-day";

const DAY = { dailyMinutes: 30, freshStart: null };

describe(hasLessonRoom, () => {
  it("holds room for the rest of the plan's day", () => {
    expect(hasLessonRoom({ day: DAY, plannedMinutes: 20 })).toBe(true);
    expect(hasLessonRoom({ day: DAY, plannedMinutes: 28 })).toBe(false);
  });

  it("holds no room past a welcome back's light day, unless it's an exam eve's full review", () => {
    const welcomeBack = { ...DAY, freshStart: "welcomeBack" as const };

    expect(hasLessonRoom({ day: welcomeBack, plannedMinutes: 15 })).toBe(false);

    expect(
      hasLessonRoom({ day: { ...welcomeBack, fullReviewSkillIds: ["skill"] }, plannedMinutes: 15 }),
    ).toBe(true);
  });
});
