import { describe, expect, it } from "vitest";
import { type GoalSize, getGoalSize, getRecommendedMinutes } from "./recommended-minutes";

const TODAY = "2026-10-05";

function minutesFor(size: GoalSize, targetDate: string | null): number {
  return getRecommendedMinutes({ size, targetDate, today: TODAY });
}

describe(getRecommendedMinutes, () => {
  it("suggests a short daily habit without a date, or with one already past", () => {
    expect([null, "2025-11-09"].map((date) => minutesFor("small", date))).toStrictEqual([15, 15]);
  });

  it("suggests more time the sooner the date is", () => {
    const dates = [
      "2026-10-20",
      "2026-11-04",
      "2026-11-08",
      "2027-01-03",
      "2027-03-01",
      "2027-09-01",
    ];

    expect(dates.map((date) => minutesFor("small", date))).toStrictEqual([60, 60, 45, 45, 30, 15]);
  });

  it("starts a big exam (a public exam, ENEM) at the time it takes, more the sooner it is", () => {
    // ENEM a month away, a concurso three months away, one half a year away, one without a date.
    const dates = ["2026-11-04", "2027-01-03", "2027-03-01", "2027-09-01", null];

    expect(dates.map((date) => minutesFor("big", date))).toStrictEqual([180, 120, 90, 60, 60]);
  });
});

describe(getGoalSize, () => {
  const exam = {
    hasNotice: false,
    isClassTest: false,
    kind: "exam" as const,
    purpose: null,
    targetDate: null,
    targetPosition: null,
    today: TODAY,
  };

  it("starts a career change near an hour a day, and more the sooner it is", () => {
    const career = getGoalSize({ ...exam, kind: "learn", purpose: "careerChange" });

    expect(career).toBe("career");
    // Six months out (Carla), three months out, and with no date.
    expect(
      ["2027-04-06", "2026-12-20", null].map((date) => minutesFor(career, date)),
    ).toStrictEqual([60, 120, 60]);

    expect(getGoalSize({ ...exam, kind: "learn", targetPosition: "UX designer" })).toBe("career");
    expect(getGoalSize({ ...exam, kind: "learn", purpose: "deep" })).toBe("small");
  });

  it("treats a test days away that no notice describes as a class test, not a public exam", () => {
    expect(getGoalSize({ ...exam, targetDate: "2026-10-09" })).toBe("classTest");
    expect(getGoalSize({ ...exam, isClassTest: true, targetDate: "2026-12-01" })).toBe("classTest");
    expect(getGoalSize({ ...exam, hasNotice: true, targetDate: "2026-10-09" })).toBe("big");
    expect(getGoalSize({ ...exam, targetDate: "2027-01-17" })).toBe("big");
  });

  it("starts a class test at a short study time: 45 min in its last week, 30 before or undated", () => {
    // Friday's test, one ten days away, one in two months, one without a date yet.
    const dates = ["2026-10-09", "2026-10-15", "2026-12-01", null];

    expect(dates.map((date) => minutesFor("classTest", date))).toStrictEqual([45, 30, 30, 30]);
  });
});
