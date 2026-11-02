import { describe, expect, it } from "vitest";
import { type AllowanceItem, getReachedCap } from "./contract";

function mindMaps(attrs: Partial<AllowanceItem>): AllowanceItem {
  return {
    dailyLimit: 3,
    fairUseDailyLimit: null,
    kind: "mindMap",
    monthlyLimit: 10,
    remaining: 1,
    totalLimit: null,
    usedThisMonth: 2,
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
      dailyLimit: null,
      fairUseDailyLimit: 30,
      monthlyLimit: null,
      remaining: null,
    });

    expect(
      getReachedCap({ allowance: { items: [plus], tier: "plus" }, kind: "mindMap" }),
    ).toBeNull();
  });

  it("names the period that ran out: the day, then the month, then a guest's total", () => {
    const today = mindMaps({ remaining: 0, usedThisMonth: 3, usedToday: 3, usedTotal: 3 });
    const month = mindMaps({ remaining: 0, usedThisMonth: 10, usedToday: 1, usedTotal: 10 });

    const guest = mindMaps({
      dailyLimit: null,
      monthlyLimit: null,
      remaining: 0,
      totalLimit: 1,
      usedTotal: 1,
    });

    expect(
      getReachedCap({ allowance: { items: [today], tier: "free" }, kind: "mindMap" }),
    ).toStrictEqual({ period: "day", status: "limitReached", tier: "free" });

    expect(
      getReachedCap({ allowance: { items: [month], tier: "free" }, kind: "mindMap" }),
    ).toMatchObject({ period: "month" });

    expect(
      getReachedCap({ allowance: { items: [guest], tier: "guest" }, kind: "mindMap" }),
    ).toMatchObject({ period: "total", tier: "guest" });
  });
});
