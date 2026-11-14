import { describe, expect, it } from "vitest";
import {
  USAGE_WINDOW_MS,
  getDailySpendBudgetMicros,
  getEstimatedCostMicros,
  getLiveCallCostMicros,
  getUsageRule,
} from "../limits";
import { evaluateUsage, getCallTimeLeft } from "./evaluate-usage";
import { type UsageCounts } from "./usage-counts";

const NOW = new Date("2026-09-15T12:00:00Z");

function counts(overrides: Partial<UsageCounts>): UsageCounts {
  const seconds = overrides.secondsLast30Days ?? 0;

  return {
    activeGoals: 0,
    callSpend: [],
    day: 0,
    generatedTotal: 0,
    lastUsedAt: null,
    lessonStarts: { count: 0, latest: [], latestPrepared: [], prepared: 0 },
    rollingClaims: seconds > 0 ? [{ amount: seconds, at: NOW }] : [],
    secondsLast30Days: 0,
    secondsToday: 0,
    spentTodayMicros: 0,
    total: 0,
    usedLast30Days: 0,
    ...overrides,
  };
}

describe(evaluateUsage, () => {
  it("reports the rolling lesson cap even when all starts happened today", () => {
    expect(
      evaluateUsage({
        costMicros: 0,
        counts: counts({
          day: 20,
          lessonStarts: {
            count: 20,
            latest: Array.from({ length: 20 }, () => NOW),
            latestPrepared: [],
            prepared: 0,
          },
          usedLast30Days: 40,
        }),
        generated: false,
        kind: "lessonStart",
        now: NOW,
        tier: "free",
      }),
    ).toStrictEqual({
      limit: {
        availableAt: new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000),
        limit: 20,
        period: "rolling30Days",
        resource: "lessonStart",
        tier: "free",
      },
      status: "limitReached",
    });
  });

  it("names the goals a learner follows before the new goals they started, since pausing one is the remedy", () => {
    expect(
      evaluateUsage({
        costMicros: 0,
        counts: counts({ activeGoals: 3, day: 3, total: 3, usedLast30Days: 3 }),
        generated: false,
        kind: "goal",
        now: NOW,
        tier: "free",
      }),
    ).toStrictEqual({
      limit: { limit: 3, period: "total", resource: "activeGoals", tier: "free" },
      status: "limitReached",
    });

    expect(
      evaluateUsage({
        costMicros: 0,
        counts: counts({ activeGoals: 2, day: 3, total: 3, usedLast30Days: 3 }),
        generated: false,
        kind: "goal",
        now: NOW,
        tier: "free",
      }),
    ).toStrictEqual({
      limit: { limit: 3, period: "day", resource: "goal", tier: "free" },
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

function plusLeft(usedLast30Days: number) {
  return getCallTimeLeft({ kind: "conversation", tier: "plus", usedLast30Days, usedToday: 0 });
}

describe(getCallTimeLeft, () => {
  it("names what's left of the month when it runs out before the day's", () => {
    expect([plusLeft(0), plusLeft(4500)]).toStrictEqual([
      { limit: 1200, period: "day", seconds: 1200 },
      { limit: 5220, period: "rolling30Days", seconds: 720 },
    ]);
  });

  it("has nothing to cap for uses that don't run for a time", () => {
    expect(
      getCallTimeLeft({ kind: "lessonStart", tier: "plus", usedLast30Days: 0, usedToday: 0 }),
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
          { secondsLast30Days: 299, tier: "free" },
          { secondsLast30Days: 300, tier: "free" },
          { secondsLast30Days: 5219, tier: "plus" },
          { secondsLast30Days: 5220, tier: "plus" },
        ] as const
      ).map(({ secondsLast30Days, tier }) =>
        evaluateUsage({ ...claim, counts: counts({ secondsLast30Days }), tier }),
      ),
    ).toStrictEqual([
      { status: "allowed" },
      {
        limit: {
          availableAt: new Date(NOW.getTime() + USAGE_WINDOW_MS),
          limit: 300,
          period: "rolling30Days",
          resource: "callSeconds",
          tier: "free",
        },
        status: "limitReached",
      },
      { status: "allowed" },
      {
        limit: {
          availableAt: new Date(NOW.getTime() + USAGE_WINDOW_MS),
          limit: 5220,
          period: "rolling30Days",
          resource: "callSeconds",
          tier: "plus",
        },
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
        { secondsLast30Days: 300, secondsToday: 120 },
        { secondsLast30Days: 300, secondsToday: 300 },
      ].map((used) => evaluateUsage({ ...claim, counts: counts(used), tier: "free" })),
    ).toStrictEqual([
      {
        limit: {
          availableAt: new Date(NOW.getTime() + USAGE_WINDOW_MS),
          limit: 300,
          period: "rolling30Days",
          resource: "callSeconds",
          tier: "free",
        },
        status: "limitReached",
      },
      {
        limit: {
          availableAt: new Date(NOW.getTime() + USAGE_WINDOW_MS),
          limit: 300,
          period: "rolling30Days",
          resource: "callSeconds",
          tier: "free",
        },
        status: "limitReached",
      },
    ]);
  });

  it("keeps the talk in a month of Plus's call minutes within $6 even if every call is a minute long", () => {
    const rolling30Days = getUsageRule({ kind: "conversation", tier: "plus" }).rolling30Days ?? 0;

    const oneMinuteCall = getLiveCallCostMicros(70);

    expect((rolling30Days / 60) * oneMinuteCall).toBeLessThanOrEqual(6_000_000);
    expect((rolling30Days / 60 + 1) * oneMinuteCall).toBeGreaterThan(6_000_000);
  });
});
