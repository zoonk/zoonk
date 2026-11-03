import { describe, expect, it } from "vitest";
import {
  getDailySpendBudgetMicros,
  getEstimatedCostMicros,
  getLiveCallCostMicros,
  getUsageRule,
} from "../limits";
import { evaluateUsage, getCallTimeLeft } from "./evaluate-usage";
import { type UsageCounts } from "./usage-counts";

const NOW = new Date("2026-09-15T12:00:00Z");

function counts(overrides: Partial<UsageCounts>): UsageCounts {
  return {
    activeGoals: 0,
    day: 0,
    generatedTotal: 0,
    lastUsedAt: null,
    month: 0,
    secondsThisMonth: 0,
    secondsToday: 0,
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

function plusLeft(usedThisMonth: number) {
  return getCallTimeLeft({ kind: "conversation", tier: "plus", usedThisMonth, usedToday: 0 });
}

describe(getCallTimeLeft, () => {
  it("names what's left of the month when it runs out before the day's", () => {
    expect([plusLeft(0), plusLeft(4500)]).toStrictEqual([
      { limit: 1200, period: "day", seconds: 1200 },
      { limit: 5220, period: "month", seconds: 720 },
    ]);
  });

  it("has nothing to cap for uses that don't run for a time", () => {
    expect(
      getCallTimeLeft({ kind: "lessonStart", tier: "plus", usedThisMonth: 0, usedToday: 0 }),
    ).toBeNull();
  });
});

describe("the plan's call time", () => {
  const claim = { costMicros: 0, generated: false, kind: "conversation", now: NOW } as const;

  it("admits a call while any of the day's call time is left", () => {
    expect(
      evaluateUsage({ ...claim, counts: counts({ secondsToday: 119 }), tier: "free" }),
    ).toStrictEqual({ status: "allowed" });

    expect(
      evaluateUsage({ ...claim, counts: counts({ secondsToday: 120 }), tier: "free" }),
    ).toStrictEqual({
      limit: { limit: 120, period: "day", resource: "callSeconds", tier: "free" },
      status: "limitReached",
    });
  });

  it("admits a call while any of the month's call time is left, whatever today's", () => {
    expect(
      (
        [
          { secondsThisMonth: 299, tier: "free" },
          { secondsThisMonth: 300, tier: "free" },
          { secondsThisMonth: 5219, tier: "plus" },
          { secondsThisMonth: 5220, tier: "plus" },
        ] as const
      ).map(({ secondsThisMonth, tier }) =>
        evaluateUsage({ ...claim, counts: counts({ secondsThisMonth }), tier }),
      ),
    ).toStrictEqual([
      { status: "allowed" },
      {
        limit: { limit: 300, period: "month", resource: "callSeconds", tier: "free" },
        status: "limitReached",
      },
      { status: "allowed" },
      {
        limit: { limit: 5220, period: "month", resource: "callSeconds", tier: "plus" },
        status: "limitReached",
      },
    ]);
  });

  it("admits a whole call while any of the day's AI budget is left", () => {
    const budget = getDailySpendBudgetMicros("free");

    const costMicros = getEstimatedCostMicros({
      generated: false,
      kind: "conversation",
      seconds: 120,
    });

    expect(
      [budget - 1, budget].map((spentTodayMicros) =>
        evaluateUsage({ ...claim, costMicros, counts: counts({ spentTodayMicros }), tier: "free" }),
      ),
    ).toStrictEqual([
      { status: "allowed" },
      {
        limit: { limit: budget, period: "day", resource: "aiSpend", tier: "free" },
        status: "limitReached",
      },
    ]);
  });

  it("names the month when both run out, since tomorrow brings no calls back", () => {
    expect(
      [
        { secondsThisMonth: 300, secondsToday: 120 },
        { secondsThisMonth: 300, secondsToday: 300 },
      ].map((used) => evaluateUsage({ ...claim, counts: counts(used), tier: "free" })),
    ).toStrictEqual([
      {
        limit: { limit: 300, period: "month", resource: "callSeconds", tier: "free" },
        status: "limitReached",
      },
      {
        limit: { limit: 300, period: "month", resource: "callSeconds", tier: "free" },
        status: "limitReached",
      },
    ]);
  });

  it("keeps the talk in a month of Plus's call minutes within $6 even if every call is a minute long", () => {
    const monthSeconds = getUsageRule({ kind: "conversation", tier: "plus" }).monthSeconds ?? 0;

    const oneMinuteCall = getLiveCallCostMicros(70);

    expect((monthSeconds / 60) * oneMinuteCall).toBeLessThanOrEqual(6_000_000);
    expect((monthSeconds / 60 + 1) * oneMinuteCall).toBeGreaterThan(6_000_000);
  });
});
