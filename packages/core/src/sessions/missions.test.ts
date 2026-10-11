import { describe, expect, it } from "vitest";
import { countDoneMissions, getMissions, isFullMeal } from "./missions";

describe(getMissions, () => {
  it("tracks the three missions from today's session", () => {
    expect(
      getMissions({
        fix: { available: true, fixedToday: 0 },
        learn: { completed: 1, lessons: 2 },
        review: { capsules: 3, opened: 2 },
      }),
    ).toStrictEqual([
      { done: 2, kind: "review", status: "todo", total: 3 },
      { done: 1, kind: "somethingNew", status: "done", total: 1 },
      { done: 0, kind: "fixMistake", status: "todo", total: 1 },
    ]);
  });

  it("says when there is nothing to review or fix today", () => {
    expect(
      getMissions({
        fix: { available: false, fixedToday: 0 },
        learn: { completed: 0, lessons: 1 },
        review: { capsules: 0, opened: 0 },
      }).map((mission) => mission.status),
    ).toStrictEqual(["nothingToday", "todo", "nothingToday"]);
  });

  it("counts a mistake fixed today even without a drill in the session", () => {
    const fix = getMissions({
      fix: { available: false, fixedToday: 2 },
      learn: { completed: 0, lessons: 0 },
      review: { capsules: 0, opened: 0 },
    }).find((mission) => mission.kind === "fixMistake");

    expect(fix).toStrictEqual({ done: 1, kind: "fixMistake", status: "done", total: 1 });
  });
});

describe(isFullMeal, () => {
  it("needs all three missions done", () => {
    const missions = getMissions({
      fix: { available: true, fixedToday: 1 },
      learn: { completed: 1, lessons: 1 },
      review: { capsules: 2, opened: 2 },
    });

    expect(isFullMeal(missions)).toBe(true);
  });

  // Pedro's first 74-second lesson paid the bonus on a day with nothing to review or fix.
  it("doesn't count a mission with nothing due as done", () => {
    const nothingToFix = getMissions({
      fix: { available: false, fixedToday: 0 },
      learn: { completed: 1, lessons: 1 },
      review: { capsules: 2, opened: 2 },
    });

    const firstDay = getMissions({
      fix: { available: false, fixedToday: 0 },
      learn: { completed: 1, lessons: 6 },
      review: { capsules: 0, opened: 0 },
    });

    expect(isFullMeal(nothingToFix)).toBe(false);
    expect(isFullMeal(firstDay)).toBe(false);
  });

  it("is not paid while a mission is left or when nothing was done", () => {
    const partial = getMissions({
      fix: { available: true, fixedToday: 0 },
      learn: { completed: 1, lessons: 1 },
      review: { capsules: 2, opened: 2 },
    });

    const empty = getMissions({
      fix: { available: false, fixedToday: 0 },
      learn: { completed: 0, lessons: 0 },
      review: { capsules: 0, opened: 0 },
    });

    expect(isFullMeal(partial)).toBe(false);
    expect(isFullMeal(empty)).toBe(false);
  });
});

describe(countDoneMissions, () => {
  it("counts only the missions actually done, never one with nothing due", () => {
    const waiting = getMissions({
      fix: { available: false, fixedToday: 0 },
      learn: { completed: 0, lessons: 6 },
      review: { capsules: 0, opened: 0 },
    });

    const firstLesson = getMissions({
      fix: { available: false, fixedToday: 0 },
      learn: { completed: 1, lessons: 6 },
      review: { capsules: 0, opened: 0 },
    });

    expect(countDoneMissions(waiting)).toBe(0);
    expect(countDoneMissions(firstLesson)).toBe(1);
  });
});
