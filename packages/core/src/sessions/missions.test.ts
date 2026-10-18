import { describe, expect, it } from "vitest";
import { countDoneMissions, getMissionBonus, getMissions, isFullMeal } from "./missions";

describe(getMissions, () => {
  it("tracks the three missions from today's session", () => {
    expect(
      getMissions({
        fix: { available: true, fixedToday: 0 },
        learn: { completed: 1, lessons: 2 },
        review: { blocks: 3, completed: 2 },
      }),
    ).toStrictEqual([
      { done: 2, kind: "review", status: "todo", total: 3 },
      { done: 1, kind: "somethingNew", status: "done", total: 1 },
      { done: 0, kind: "fixMistake", status: "todo", total: 1 },
    ]);
  });

  it("omits kinds with nothing available today", () => {
    expect(
      getMissions({
        fix: { available: false, fixedToday: 0 },
        learn: { completed: 0, lessons: 1 },
        review: { blocks: 0, completed: 0 },
      }).map((mission) => mission.status),
    ).toStrictEqual(["todo"]);
  });

  it("counts a mistake fixed today even without a drill in the session", () => {
    const fix = getMissions({
      fix: { available: false, fixedToday: 2 },
      learn: { completed: 0, lessons: 0 },
      review: { blocks: 0, completed: 0 },
    }).find((mission) => mission.kind === "fixMistake");

    expect(fix).toStrictEqual({ done: 1, kind: "fixMistake", status: "done", total: 1 });
  });
});

describe(isFullMeal, () => {
  it("needs every offered mission done", () => {
    const missions = getMissions({
      fix: { available: true, fixedToday: 1 },
      learn: { completed: 1, lessons: 1 },
      review: { blocks: 2, completed: 2 },
    });

    expect(isFullMeal(missions)).toBe(true);
  });

  // A day with fewer possible missions still earns the full bonus.
  it("pays the full bonus when one or two missions were possible", () => {
    const nothingToFix = getMissions({
      fix: { available: false, fixedToday: 0 },
      learn: { completed: 1, lessons: 1 },
      review: { blocks: 2, completed: 2 },
    });

    const firstDay = getMissions({
      fix: { available: false, fixedToday: 0 },
      learn: { completed: 1, lessons: 6 },
      review: { blocks: 0, completed: 0 },
    });

    expect(isFullMeal(nothingToFix)).toBe(true);
    expect(getMissionBonus(nothingToFix)).toBe(50);
    expect(isFullMeal(firstDay)).toBe(true);
    expect(getMissionBonus(firstDay)).toBe(50);
  });

  it("is not paid while a mission is left or when nothing was done", () => {
    const partial = getMissions({
      fix: { available: true, fixedToday: 0 },
      learn: { completed: 1, lessons: 1 },
      review: { blocks: 2, completed: 2 },
    });

    const empty = getMissions({
      fix: { available: false, fixedToday: 0 },
      learn: { completed: 0, lessons: 0 },
      review: { blocks: 0, completed: 0 },
    });

    expect(isFullMeal(partial)).toBe(false);
    expect(isFullMeal(empty)).toBe(false);
    expect(getMissionBonus(empty)).toBe(0);
  });
});

describe(countDoneMissions, () => {
  it("counts only offered missions actually done", () => {
    const waiting = getMissions({
      fix: { available: false, fixedToday: 0 },
      learn: { completed: 0, lessons: 6 },
      review: { blocks: 0, completed: 0 },
    });

    const firstLesson = getMissions({
      fix: { available: false, fixedToday: 0 },
      learn: { completed: 1, lessons: 6 },
      review: { blocks: 0, completed: 0 },
    });

    expect(countDoneMissions(waiting)).toBe(0);
    expect(countDoneMissions(firstLesson)).toBe(1);
  });
});
