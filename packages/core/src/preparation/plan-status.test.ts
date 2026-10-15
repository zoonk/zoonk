import { type PlanItemStatus } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import {
  type PlanStatusItem,
  getPlanLifecycle,
  getPlanPace,
  getPlanStatus,
  hasWorkAfterDate,
} from "./plan-status";

const TODAY = new Date("2026-09-10T00:00:00Z");

/** Two items a day from September 6 to 15. */
function schedule(finished: number): PlanStatusItem[] {
  return Array.from({ length: 20 }, (_, index) => ({
    chapterId: "chapter",
    kind: "lesson",
    lessonId: `lesson-${index}`,
    scheduledFor: new Date(Date.UTC(2026, 8, 6 + Math.floor(index / 2))),
    skillId: "skill",
    status: index < finished ? "done" : "todo",
  }));
}

/** The first five items tested out, the next five skipped, the rest still to do. */
function getFinishedStatus(index: number): PlanItemStatus {
  if (index < 5) {
    return "testedOut";
  }

  return index < 10 ? "skipped" : "todo";
}

describe(getPlanStatus, () => {
  it.each(["2026-09-06", "2026-10-01"])(
    "ignores locked language calls when measuring Free pace (%s)",
    (date) => {
      const locked = Array.from({ length: 4 }, () => ({
        chapterId: null,
        kind: "boss" as const,
        lessonId: null,
        scheduledFor: new Date(`${date}T00:00:00Z`),
        skillId: null,
        status: "todo" as const,
      }));

      expect(
        getPlanStatus({
          goalKind: "language",
          items: [...schedule(8), ...locked],
          minutesPerItem: 4,
          phaseChallengesRequired: false,
          targetDate: new Date("2026-09-20T00:00:00Z"),
          today: TODAY,
        }),
      ).toStrictEqual({ kind: "onTrack" });
    },
  );

  it("has no status before anything is scheduled", () => {
    expect(
      getPlanStatus({
        goalKind: "learn",
        items: [
          {
            chapterId: null,
            kind: "lesson",
            lessonId: "lesson",
            scheduledFor: null,
            skillId: null,
            status: "todo",
          },
        ],
        minutesPerItem: 4,
        targetDate: null,
        today: TODAY,
      }),
    ).toBeNull();
  });

  it("keeps pace within a day's worth of items", () => {
    expect(
      getPlanStatus({
        goalKind: "learn",
        items: schedule(9),
        minutesPerItem: 4,
        targetDate: null,
        today: TODAY,
      }),
    ).toStrictEqual({ kind: "onTrack" });
  });

  it("says how many days ahead", () => {
    expect(
      getPlanStatus({
        goalKind: "learn",
        items: schedule(14),
        minutesPerItem: 4,
        targetDate: null,
        today: TODAY,
      }),
    ).toStrictEqual({ days: 2, kind: "ahead" });
  });

  it("offers the fix when a little behind", () => {
    expect(
      getPlanStatus({
        goalKind: "learn",
        items: schedule(6),
        minutesPerItem: 4,
        targetDate: null,
        today: TODAY,
      }),
    ).toStrictEqual({ days: 1, extraMinutesPerDay: 10, kind: "behind", lessons: null });
  });

  it("is behind while lessons earlier days left aren't done, whatever the dates say", () => {
    expect(
      getPlanStatus({
        catchUp: 3,
        goalKind: "learn",
        items: schedule(9),
        minutesPerItem: 4,
        targetDate: null,
        today: TODAY,
      }),
    ).toStrictEqual({ days: 0, extraMinutesPerDay: 0, kind: "behind", lessons: 3 });
  });

  it("isn't behind for today's items before the learner studies", () => {
    expect(
      getPlanStatus({
        goalKind: "learn",
        items: schedule(8),
        minutesPerItem: 4,
        targetDate: null,
        today: TODAY,
      }),
    ).toStrictEqual({ kind: "onTrack" });
  });

  it("needs adjusting when the fix would take over a week", () => {
    expect(
      getPlanStatus({
        goalKind: "learn",
        items: schedule(0),
        minutesPerItem: 10,
        targetDate: null,
        today: TODAY,
      }),
    ).toStrictEqual({ kind: "needsAdjusting", options: ["addTime", "narrowScope"] });
  });

  it("needs adjusting, with moving the date, when the plan runs past the target", () => {
    expect(
      getPlanStatus({
        goalKind: "learn",
        items: schedule(10),
        minutesPerItem: 4,
        targetDate: new Date("2026-09-12T00:00:00Z"),
        today: TODAY,
      }),
    ).toStrictEqual({ kind: "needsAdjusting", options: ["addTime", "narrowScope", "moveDate"] });
  });

  it("keeps pace when the learner chose to go on after the target date", () => {
    expect(
      getPlanStatus({
        goalKind: "learn",
        items: schedule(10),
        minutesPerItem: 4,
        studiesPastTarget: true,
        targetDate: new Date("2026-09-12T00:00:00Z"),
        today: TODAY,
      }),
    ).toStrictEqual({ kind: "onTrack" });
  });

  it("counts tested-out and skipped items as finished", () => {
    const items = schedule(0).map((item, index) => ({ ...item, status: getFinishedStatus(index) }));

    expect(
      getPlanStatus({
        goalKind: "learn",
        items,
        minutesPerItem: 4,
        targetDate: null,
        today: TODAY,
      }),
    ).toStrictEqual({ kind: "onTrack" });
  });

  it("is finished once nothing is left, however far ahead of its dates", () => {
    expect(
      getPlanStatus({
        goalKind: "learn",
        items: schedule(20),
        minutesPerItem: 4,
        targetDate: null,
        today: TODAY,
      }),
    ).toStrictEqual({ kind: "finished" });
  });

  it("is finished once nothing is left, its date passed or not", () => {
    expect(
      getPlanStatus({
        goalKind: "learn",
        items: schedule(20),
        minutesPerItem: 4,
        targetDate: new Date("2026-09-08T00:00:00Z"),
        today: TODAY,
      }),
    ).toStrictEqual({ kind: "finished" });
  });

  // Lucas's date came with lessons he hadn't studied: his plan read "Ended" and stopped there.
  it("is past its date once it came with lessons left, to do or set aside, a stand-in as its lessons", () => {
    const items: PlanStatusItem[] = schedule(16).map((item, index) =>
      index < 18 ? item : { ...item, status: "skipped" },
    );

    const standIn: PlanStatusItem = {
      chapterId: null,
      kind: "lesson",
      lessonId: null,
      lessons: 3,
      scheduledFor: new Date("2026-09-09T00:00:00Z"),
      skillId: "later skill",
      status: "skipped",
    };

    const challenge: PlanStatusItem = {
      chapterId: null,
      kind: "boss",
      lessonId: null,
      scheduledFor: new Date("2026-09-09T00:00:00Z"),
      skillId: null,
      status: "todo",
    };

    expect(
      getPlanStatus({
        goalKind: "learn",
        items: [...items, standIn, challenge],
        minutesPerItem: 4,
        targetDate: new Date("2026-09-10T00:00:00Z"),
        today: TODAY,
      }),
    ).toStrictEqual({ kind: "pastDate", lessons: 7 });
  });

  it("reads its dates while its date is ahead, or for an exam studied past it", () => {
    const items: PlanStatusItem[] = schedule(18).map((item, index) =>
      index < 18 ? item : { ...item, status: "skipped" },
    );

    expect(
      getPlanStatus({
        goalKind: "learn",
        items,
        minutesPerItem: 4,
        targetDate: new Date("2026-09-12T00:00:00Z"),
        today: TODAY,
      }),
    ).toStrictEqual({ days: 5, kind: "ahead" });

    expect(
      getPlanStatus({
        goalKind: "learn",
        items: schedule(16),
        minutesPerItem: 4,
        studiesPastTarget: true,
        targetDate: new Date("2026-09-09T00:00:00Z"),
        today: TODAY,
      }),
    ).not.toMatchObject({ kind: "pastDate" });
  });
});

const readPace = (finished: number, attrs: Partial<Parameters<typeof getPlanPace>[0]> = {}) =>
  getPlanPace({
    catchUp: 0,
    freeWeekOver: false,
    items: schedule(finished),
    minutesPerItem: 4,
    phaseChallengesRequired: true,
    targetDate: new Date("2026-09-20T00:00:00Z"),
    today: TODAY,
    ...attrs,
  });

const readWorkAfter = (targetDate: string, studiesPastTarget = false) =>
  hasWorkAfterDate({
    items: schedule(8),
    phaseChallengesRequired: true,
    studiesPastTarget,
    targetDate: new Date(`${targetDate}T00:00:00Z`),
  });

const readLifecycle = (finished: number, today = TODAY) =>
  getPlanLifecycle({
    freeWeekOver: false,
    goalKind: "learn",
    items: schedule(finished),
    phaseChallengesRequired: true,
    studiesPastTarget: false,
    targetDate: new Date("2026-09-20T00:00:00Z"),
    today,
  });

describe(getPlanPace, () => {
  it("reads the learner's pace against the stored dates, never whether the plan fits", () => {
    expect(readPace(8)).toStrictEqual({ kind: "onPace" });
    expect(readPace(14)).toStrictEqual({ days: 2, kind: "ahead" });

    expect(readPace(4)).toStrictEqual({
      catchUp: { days: 2, extraMinutesPerDay: 10 },
      kind: "behind",
      lessons: null,
    });
  });

  // Far behind is still a pace: whether the plan reaches the goal is its fit's to say.
  it("says behind without a small fix when none catches up, never needs adjusting", () => {
    expect(readPace(0, { minutesPerItem: 20 })).toStrictEqual({
      catchUp: null,
      kind: "behind",
      lessons: null,
    });
  });

  it("is behind by the lessons earlier days left while they aren't done", () => {
    expect(readPace(8, { catchUp: 3 })).toStrictEqual({
      catchUp: null,
      kind: "behind",
      lessons: 3,
    });
  });

  it("has no pace before anything is scheduled, or for a plan only Plus moves", () => {
    expect(readPace(8, { items: [] })).toBeNull();
    expect(readPace(8, { freeWeekOver: true })).toBeNull();
  });
});

describe(hasWorkAfterDate, () => {
  it("reads work still to do after the goal's date, unless the learner studies past it", () => {
    expect(readWorkAfter("2026-09-20")).toBe(false);
    expect(readWorkAfter("2026-09-12")).toBe(true);
    expect(readWorkAfter("2026-09-12", true)).toBe(false);
  });
});

describe(getPlanLifecycle, () => {
  it("goes on while lessons are left before the date", () => {
    expect(readLifecycle(8)).toBeNull();
  });

  it("is finished once nothing is left, and past its date once it came with lessons left", () => {
    expect(readLifecycle(20)).toStrictEqual({ kind: "finished" });

    expect(readLifecycle(8, new Date("2026-09-21T00:00:00Z"))).toStrictEqual({
      kind: "pastDate",
      lessons: 12,
    });
  });
});
