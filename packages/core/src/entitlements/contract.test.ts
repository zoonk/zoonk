import { describe, expect, it } from "vitest";
import { type AllowanceItem, getReachedCap } from "./contract";

function mindMaps(attrs: Partial<Exclude<AllowanceItem, { kind: "lessonStart" }>>): AllowanceItem {
  return {
    availableAt: null,
    dailyLimit: 3,
    fairUseDailyLimit: null,
    kind: "mindMap",
    remaining: 1,
    rollingLimit: 10,
    totalLimit: null,
    usedLast30Days: 2,
    usedToday: 2,
    usedTotal: 2,
    ...attrs,
  };
}

describe(getReachedCap, () => {
  it("is null while any is left, and for a plan that only has fair use", () => {
    expect(
      getReachedCap({ allowance: { items: [mindMaps({})], tier: "free" }, kind: "mindMap" }),
    ).toBeNull();

    const plus = mindMaps({
      availableAt: null,
      dailyLimit: null,
      fairUseDailyLimit: 30,
      remaining: null,
      rollingLimit: null,
    });

    expect(
      getReachedCap({ allowance: { items: [plus], tier: "plus" }, kind: "mindMap" }),
    ).toBeNull();
  });

  it("names the period that ran out: the day, then the month, then a guest's total", () => {
    const today = mindMaps({ remaining: 0, usedLast30Days: 3, usedToday: 3, usedTotal: 3 });
    const month = mindMaps({ remaining: 0, usedLast30Days: 10, usedToday: 1, usedTotal: 10 });

    const guest = mindMaps({
      availableAt: null,
      dailyLimit: null,
      remaining: 0,
      rollingLimit: null,
      totalLimit: 1,
      usedTotal: 1,
    });

    expect(
      getReachedCap({ allowance: { items: [today], tier: "free" }, kind: "mindMap" }),
    ).toStrictEqual({ period: "day", status: "limitReached", tier: "free" });

    expect(
      getReachedCap({ allowance: { items: [month], tier: "free" }, kind: "mindMap" }),
    ).toMatchObject({ period: "rolling30Days" });

    expect(
      getReachedCap({ allowance: { items: [guest], tier: "guest" }, kind: "mindMap" }),
    ).toMatchObject({ period: "total", tier: "guest" });
  });
});
