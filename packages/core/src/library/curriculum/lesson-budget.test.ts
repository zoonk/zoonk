import { describe, expect, it } from "vitest";
import { getLessonBudget } from "./lesson-budget";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe(getLessonBudget, () => {
  // The graph is written before the learner picks a daily time, so the budget never reads the
  // goal's placeholder minutes: at 15 a test on Friday from Wednesday held one lesson, and Pedro's
  // six headings became one skill.
  it("lets a test on Friday from Wednesday hold a lesson for every topic of a short handout", () => {
    expect(getLessonBudget({ targetDate: day("2026-10-09"), today: day("2026-10-07") })).toBe(15);
  });

  it("grows with the days before the test, and leaves a test weeks away to the usual plan", () => {
    expect(getLessonBudget({ targetDate: day("2026-10-09"), today: day("2026-10-06") })).toBe(25);
    expect(getLessonBudget({ targetDate: day("2026-11-20"), today: day("2026-10-06") })).toBeNull();
    expect(getLessonBudget({ targetDate: null, today: day("2026-10-06") })).toBeNull();
  });
});
