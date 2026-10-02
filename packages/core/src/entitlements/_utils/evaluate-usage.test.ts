import { describe, expect, it } from "vitest";
import { getDailySpendBudgetMicros, getEstimatedCostMicros } from "../limits";
import { evaluateUsage } from "./evaluate-usage";
import { type UsageCounts } from "./usage-counts";

const NOW = new Date("2026-09-15T12:00:00Z");

function counts(overrides: Partial<UsageCounts>): UsageCounts {
  return {
    activeGoals: 0,
    day: 0,
    generatedTotal: 0,
    lastUsedAt: null,
    month: 0,
    spentTodayMicros: 0,
    total: 0,
    ...overrides,
  };
}

describe(evaluateUsage, () => {
  it("reports the first cap a learner hits, the daily one before the monthly one", () => {
    expect(
      evaluateUsage({
        costMicros: 0,
        counts: counts({ day: 20, month: 40 }),
        generated: false,
        kind: "lessonStart",
        now: NOW,
        tier: "free",
      }),
    ).toStrictEqual({
      limit: { limit: 20, period: "day", resource: "lessonStart", tier: "free" },
      status: "limitReached",
    });
  });

  it("only slows fair use down for the time left since the last use", () => {
    const claim = {
      costMicros: 0,
      generated: false,
      kind: "tutorMessage" as const,
      now: NOW,
      tier: "plus" as const,
    };

    expect(
      evaluateUsage({
        ...claim,
        counts: counts({ day: 300, lastUsedAt: new Date(NOW.getTime() - 100_000) }),
      }),
    ).toStrictEqual({ retryAfterSeconds: 200, status: "slowDown" });

    expect(
      evaluateUsage({
        ...claim,
        counts: counts({ day: 300, lastUsedAt: new Date(NOW.getTime() - 300_000) }),
      }),
    ).toStrictEqual({ status: "allowed" });

    expect(
      evaluateUsage({
        ...claim,
        counts: counts({ day: 299, lastUsedAt: new Date(NOW.getTime() - 1000) }),
      }),
    ).toStrictEqual({ status: "allowed" });
  });

  it("blocks new generation that would pass the daily AI budget but not reused content", () => {
    const budget = getDailySpendBudgetMicros("free");
    const spent = counts({ spentTodayMicros: budget - 1000 });

    expect(
      evaluateUsage({
        costMicros: getEstimatedCostMicros({ generated: true, kind: "lessonStart" }),
        counts: spent,
        generated: true,
        kind: "lessonStart",
        now: NOW,
        tier: "free",
      }),
    ).toMatchObject({ limit: { limit: budget, resource: "aiSpend" }, status: "limitReached" });

    expect(
      evaluateUsage({
        costMicros: 0,
        counts: spent,
        generated: false,
        kind: "lessonStart",
        now: NOW,
        tier: "free",
      }),
    ).toStrictEqual({ status: "allowed" });
  });
});
