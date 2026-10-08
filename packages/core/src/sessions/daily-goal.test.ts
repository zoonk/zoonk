import { describe, expect, it } from "vitest";
import {
  type PlanDay,
  getBlockMinutes,
  getSessionMinutesDone,
  getWeekDayKind,
  getWeekDays,
} from "./daily-goal";

const WEDNESDAY = new Date("2026-09-30T00:00:00Z");

/** A plan of `minutes` a day that rests on Sundays. */
function restsOnSundays(minutes: number) {
  return (date: Date): PlanDay =>
    date.getUTCDay() === 0
      ? { goalMinutes: 0, kind: "rest" }
      : { goalMinutes: minutes, kind: "study" };
}

describe(getWeekDays, () => {
  it("shows each day's minutes, whether it hit the goal and partial days as studied", () => {
    const week = getWeekDays({
      days: [
        { date: new Date("2026-09-28T00:00:00Z"), seconds: 45 * 60 },
        { date: new Date("2026-09-29T00:00:00Z"), seconds: 18 * 60 + 30 },
        { date: new Date("2026-09-21T00:00:00Z"), seconds: 3600 },
      ],
      getPlanDay: restsOnSundays(45),
      today: WEDNESDAY,
    });

    expect(week).toHaveLength(7);
    expect(week.at(-1)).toMatchObject({ goalMinutes: 0, hitGoal: false, kind: "rest" });

    expect(week.slice(0, 3)).toStrictEqual([
      {
        date: new Date("2026-09-28T00:00:00Z"),
        goalMinutes: 45,
        hitGoal: true,
        isToday: false,
        kind: "study",
        minutes: 45,
        studied: true,
      },
      {
        date: new Date("2026-09-29T00:00:00Z"),
        goalMinutes: 45,
        hitGoal: false,
        isToday: false,
        kind: "study",
        minutes: 18,
        studied: true,
      },
      {
        date: WEDNESDAY,
        goalMinutes: 45,
        hitGoal: false,
        isToday: true,
        kind: "study",
        minutes: 0,
        studied: false,
      },
    ]);
  });

  it("counts a day whose session was finished as reaching its goal, in fewer minutes too", () => {
    const week = getWeekDays({
      completedDates: [new Date("2026-09-29T00:00:00Z"), new Date("2026-10-04T00:00:00Z")],
      days: [{ date: new Date("2026-09-29T00:00:00Z"), seconds: 17 * 60 }],
      getPlanDay: restsOnSundays(21),
      today: WEDNESDAY,
    });

    expect(week[1]).toMatchObject({ goalMinutes: 21, hitGoal: true, minutes: 17, studied: true });

    // A rest day has no goal to reach, even with a session finished on it.
    expect(week.at(-1)).toMatchObject({ goalMinutes: 0, hitGoal: false, studied: true });
  });
});

function day(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

describe(getWeekDayKind, () => {
  const exam = { isExam: true, startDate: WEDNESDAY, targetDate: new Date("2026-10-02T00:00:00Z") };

  it("names days without study for what they are: outside the plan, the exam or a rest day", () => {
    const kindOf = (iso: string, goalMinutes = 0) =>
      getWeekDayKind({ date: day(iso), goalMinutes, goals: [exam] });

    expect(kindOf("2026-09-28")).toBe("beforeStart");
    expect(kindOf("2026-09-30", 30)).toBe("study");
    expect(kindOf("2026-10-01")).toBe("rest");
    expect(kindOf("2026-10-02")).toBe("exam");
    expect(kindOf("2026-10-03")).toBe("afterEnd");

    expect(
      getWeekDayKind({
        date: day("2026-10-02"),
        goalMinutes: 0,
        goals: [{ ...exam, isExam: false }],
      }),
    ).toBe("deadline");

    // Without any goal, nothing was ever planned.
    expect(getWeekDayKind({ date: WEDNESDAY, goalMinutes: 0, goals: [] })).toBe("beforeStart");
  });
});

describe(getBlockMinutes, () => {
  it("counts time from start to finish, capped at twice the estimate", () => {
    const startedAt = new Date("2026-09-30T10:00:00Z");

    expect(
      getBlockMinutes({
        completedAt: new Date("2026-09-30T10:06:00Z"),
        estimatedMinutes: 5,
        startedAt,
      }),
    ).toBe(6);

    expect(
      getBlockMinutes({
        completedAt: new Date("2026-09-30T12:00:00Z"),
        estimatedMinutes: 5,
        startedAt,
      }),
    ).toBe(10);
  });

  it("counts nothing for unfinished blocks and the estimate without a start", () => {
    expect(getBlockMinutes({ completedAt: null, estimatedMinutes: 5, startedAt: null })).toBe(0);

    expect(getBlockMinutes({ completedAt: WEDNESDAY, estimatedMinutes: 5, startedAt: null })).toBe(
      5,
    );
  });
});

describe(getSessionMinutesDone, () => {
  it("counts the planned minutes of finished blocks, however fast the learner went", () => {
    const start = new Date("2026-10-06T12:00:00Z");
    const oneMinuteLater = new Date("2026-10-06T12:01:00Z");

    const blocks = [
      // Four quick lessons planned at 8 minutes each: the day is 32 minutes along, not 4.
      ...Array.from({ length: 4 }, () => ({
        completedAt: oneMinuteLater,
        estimatedMinutes: 8,
        startedAt: start,
        status: "completed" as const,
      })),
      { completedAt: null, estimatedMinutes: 10, startedAt: start, status: "active" as const },
      { completedAt: null, estimatedMinutes: 12, startedAt: null, status: "pending" as const },
      { completedAt: start, estimatedMinutes: 6, startedAt: null, status: "skipped" as const },
    ];

    expect(getSessionMinutesDone(blocks)).toBe(32);
  });
});
