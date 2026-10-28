import { describe, expect, it } from "vitest";
import { countDoneMissions, getMissionBonus, isFullMeal } from "./missions";

const done = { status: "done" as const };
const todo = { status: "todo" as const };

describe(isFullMeal, () => {
  it("needs every offered mission done", () => {
    expect(isFullMeal([done, done, done])).toBe(true);
  });

  it("pays the full bonus when one or two missions were possible", () => {
    expect(isFullMeal([done, done])).toBe(true);
    expect(getMissionBonus([done, done])).toBe(50);
    expect(isFullMeal([done])).toBe(true);
    expect(getMissionBonus([done])).toBe(50);
  });

  it("is not paid while a mission is left or when nothing was done", () => {
    expect(isFullMeal([done, done, todo])).toBe(false);
    expect(isFullMeal([])).toBe(false);
    expect(getMissionBonus([])).toBe(0);
  });
});

describe(countDoneMissions, () => {
  it("counts only offered missions actually done", () => {
    expect(countDoneMissions([todo])).toBe(0);
    expect(countDoneMissions([done, todo])).toBe(1);
  });
});
