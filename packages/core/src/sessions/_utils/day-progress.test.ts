import { type PlanItem } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { getDayCatchUp, getDayProgress } from "./day-progress";

const DAY_START = new Date("2026-11-11T03:00:00Z");
const EARLIER_TODAY = new Date("2026-11-11T09:00:00Z");
const YESTERDAY = new Date("2026-11-10T20:00:00Z");

type CatchUpItem = Pick<
  PlanItem,
  "chapterId" | "completedAt" | "id" | "kind" | "lessonId" | "status"
>;

function item(attrs: Partial<CatchUpItem> & Pick<CatchUpItem, "id">): CatchUpItem {
  return {
    chapterId: null,
    completedAt: null,
    kind: "lesson",
    lessonId: `lesson-${attrs.id}`,
    status: "todo",
    ...attrs,
  };
}

function progress({
  completed,
  complete = false,
  lessonsComing = false,
  reserved = false,
  total,
}: {
  completed: number;
  complete?: boolean;
  lessonsComing?: boolean;
  reserved?: boolean;
  total: number;
}) {
  return getDayProgress({
    catchUp: null,
    complete,
    lessonsComing,
    reserved,
    sessionBar: { completed, total },
  });
}

describe("the day's progress at a block's end", () => {
  it("leads with what's done up to and including the midpoint, then with what's left", () => {
    expect(progress({ completed: 2, total: 8 })).toMatchObject({ lead: "done", percent: 25 });
    expect(progress({ completed: 4, total: 8 })).toMatchObject({ lead: "done", percent: 50 });
    expect(progress({ completed: 5, total: 8 })).toMatchObject({ lead: "left", percent: 62 });
    expect(progress({ completed: 5, total: 9 })).toMatchObject({ lead: "left", percent: 55 });
    expect(progress({ completed: 4, total: 9 })).toMatchObject({ lead: "done", percent: 44 });
  });

  it("keeps the percent below 100 until the session is complete", () => {
    expect(progress({ completed: 199, total: 200 })).toMatchObject({ lead: "left", percent: 99 });
    expect(progress({ completed: 3, total: 3 })).toMatchObject({ lead: "left", percent: 99 });
    expect(progress({ completed: 0, total: 3 })).toMatchObject({ lead: "done", percent: 0 });

    expect(progress({ complete: true, completed: 8, total: 8 })).toStrictEqual({
      catchUp: null,
      lead: "complete",
      lessonsComing: false,
      percent: 100,
    });

    expect(progress({ complete: true, completed: 1, total: 1 })).toMatchObject({
      lead: "complete",
      percent: 100,
    });
  });

  it("has no total to count down while the day holds time for lessons not on the list yet", () => {
    expect(progress({ completed: 3, lessonsComing: true, reserved: true, total: 4 })).toStrictEqual(
      { catchUp: null, lead: "open", lessonsComing: true, percent: null },
    );

    expect(progress({ completed: 3, reserved: true, total: 3 })).toMatchObject({
      lead: "open",
      lessonsComing: false,
      percent: null,
    });
  });

  it("says lessons are coming only while the day is open", () => {
    expect(progress({ completed: 1, lessonsComing: true, total: 4 })).toMatchObject({
      lead: "done",
      lessonsComing: false,
    });
  });

  it("has no percent when no block counts", () => {
    expect(progress({ completed: 0, total: 0 })).toMatchObject({ percent: null });

    expect(progress({ complete: true, completed: 0, total: 0 })).toMatchObject({
      lead: "complete",
      percent: null,
    });
  });
});

describe("the catch-up line at a block's end", () => {
  const carried = [
    item({ id: "left-1" }),
    item({ id: "left-2" }),
    item({ chapterId: "chapter-1", id: "left-chapter", kind: "chapter", lessonId: null }),
    item({ completedAt: EARLIER_TODAY, id: "done-today", status: "done" }),
    item({ completedAt: DAY_START, id: "done-at-midnight", status: "done" }),
    item({ completedAt: YESTERDAY, id: "done-yesterday", status: "done" }),
    item({ completedAt: EARLIER_TODAY, id: "tested-out", status: "testedOut" }),
    item({ id: "stand-in", lessonId: null }),
    item({ id: "challenge", kind: "boss", lessonId: null }),
  ];

  const items = [
    ...carried,
    item({ id: "not-carried" }),
    item({ completedAt: EARLIER_TODAY, id: "not-carried-done", status: "done" }),
  ];

  function catchUp(input: Partial<Parameters<typeof getDayCatchUp>[0]> = {}) {
    return getDayCatchUp({
      carriedItemIds: carried.map((carriedItem) => carriedItem.id),
      dayStart: DAY_START,
      freshStart: null,
      items,
      trialEnded: false,
      ...input,
    });
  }

  it("counts the carried lessons still to do and those done since the day began", () => {
    expect(catchUp()).toStrictEqual({ doneToday: 2, lessonsLeft: 3 });
  });

  it("lets a tested-out lesson leave the count without catching it up", () => {
    expect(catchUp({ carriedItemIds: ["left-1", "tested-out"] })).toStrictEqual({
      doneToday: 0,
      lessonsLeft: 1,
    });
  });

  it("shows nothing left once every carried lesson is done, while some were caught up today", () => {
    expect(catchUp({ carriedItemIds: ["done-today", "tested-out"] })).toStrictEqual({
      doneToday: 1,
      lessonsLeft: 0,
    });
  });

  it("has no line when none are left and none were caught up today", () => {
    expect(catchUp({ carriedItemIds: ["done-yesterday", "tested-out", "stand-in"] })).toBeNull();
  });

  it("has no line when nothing is carried", () => {
    expect(catchUp({ carriedItemIds: [] })).toBeNull();
  });

  it("has no line on a welcome-back session or after the free week, but keeps it on other fresh starts", () => {
    expect(catchUp({ freshStart: "welcomeBack" })).toBeNull();
    expect(catchUp({ trialEnded: true })).toBeNull();
    expect(catchUp({ freshStart: "newWeek" })).toStrictEqual({ doneToday: 2, lessonsLeft: 3 });
  });
});
