import { type PlanItemStatus } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { type PlanStatusItem, getPlanStatus } from "./plan-status";

const TODAY = new Date("2026-09-10T00:00:00Z");

/** Two items a day from September 6 to 15. */
function schedule(finished: number): PlanStatusItem[] {
  return Array.from({ length: 20 }, (_, index) => ({
    scheduledFor: new Date(Date.UTC(2026, 8, 6 + Math.floor(index / 2))),
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
  it("has no status before anything is scheduled", () => {
    expect(
      getPlanStatus({
        items: [{ scheduledFor: null, status: "todo" }],
        minutesPerItem: 4,
        targetDate: null,
        today: TODAY,
      }),
    ).toBeNull();
  });

  it("is on track within a day's worth of items", () => {
    expect(
      getPlanStatus({ items: schedule(9), minutesPerItem: 4, targetDate: null, today: TODAY }),
    ).toStrictEqual({ kind: "onTrack" });
  });

  it("says how many days ahead", () => {
    expect(
      getPlanStatus({ items: schedule(14), minutesPerItem: 4, targetDate: null, today: TODAY }),
    ).toStrictEqual({ days: 2, kind: "ahead" });
  });

  it("offers the fix when a little behind", () => {
    expect(
      getPlanStatus({ items: schedule(6), minutesPerItem: 4, targetDate: null, today: TODAY }),
    ).toStrictEqual({ days: 1, extraMinutesPerDay: 10, kind: "behind", lessons: null });
  });

  it("is behind while lessons earlier days left aren't done, whatever the dates say", () => {
    expect(
      getPlanStatus({
        catchUp: 3,
        items: schedule(9),
        minutesPerItem: 4,
        targetDate: null,
        today: TODAY,
      }),
    ).toStrictEqual({ days: 0, extraMinutesPerDay: 0, kind: "behind", lessons: 3 });
  });

  it("isn't behind for today's items before the learner studies", () => {
    expect(
      getPlanStatus({ items: schedule(8), minutesPerItem: 4, targetDate: null, today: TODAY }),
    ).toStrictEqual({ kind: "onTrack" });
  });

  it("needs adjusting when the fix would take over a week", () => {
    expect(
      getPlanStatus({ items: schedule(0), minutesPerItem: 10, targetDate: null, today: TODAY }),
    ).toStrictEqual({ kind: "needsAdjusting", options: ["addTime", "narrowScope"] });
  });

  it("needs adjusting, with moving the date, when the plan runs past the target", () => {
    expect(
      getPlanStatus({
        items: schedule(10),
        minutesPerItem: 4,
        targetDate: new Date("2026-09-12T00:00:00Z"),
        today: TODAY,
      }),
    ).toStrictEqual({ kind: "needsAdjusting", options: ["addTime", "narrowScope", "moveDate"] });
  });

  it("counts tested-out and skipped items as finished", () => {
    const items = schedule(0).map((item, index) => ({ ...item, status: getFinishedStatus(index) }));

    expect(
      getPlanStatus({ items, minutesPerItem: 4, targetDate: null, today: TODAY }),
    ).toStrictEqual({ kind: "onTrack" });
  });
});
