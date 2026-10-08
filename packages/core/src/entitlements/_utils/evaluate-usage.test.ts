import { describe, expect, it } from "vitest";
import { getDailySpendBudgetMicros, getEstimatedCostMicros, getUsageRule } from "../limits";
import { evaluateUsage, getCallHold, getCallTimeLeft } from "./evaluate-usage";
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

/** What a call of `seconds` holds, with this much of the plan's call time used. */
function hold({
  seconds = 120,
  tier,
  usedThisMonth = 0,
  usedToday = 0,
}: {
  seconds?: number;
  tier: "free" | "plus";
  usedThisMonth?: number;
  usedToday?: number;
}) {
  return getCallHold({
    left: getCallTimeLeft({ kind: "conversation", tier, usedThisMonth, usedToday }),
    seconds,
  });
}

/** What's left of Plus's call time, with this much of the month's used and none of today's. */
function plusLeft(usedThisMonth: number) {
  return getCallTimeLeft({ kind: "conversation", tier: "plus", usedThisMonth, usedToday: 0 });
}

describe(getCallHold, () => {
  it("holds a call's length, or what's left of the plan's call time today", () => {
    expect([
      hold({ tier: "free" }),
      hold({ tier: "free", usedThisMonth: 30, usedToday: 30 }),
      hold({ tier: "free", usedThisMonth: 130, usedToday: 130 }),
      hold({ tier: "plus", usedThisMonth: 210, usedToday: 210 }),
    ]).toStrictEqual([
      { heldSeconds: 120, shortenedBy: null },
      { heldSeconds: 90, shortenedBy: "day" },
      { heldSeconds: 0, shortenedBy: "day" },
      { heldSeconds: 120, shortenedBy: null },
    ]);
  });

  it("holds what's left of the month's call time when it runs out before the day's", () => {
    expect([plusLeft(0), plusLeft(4500)]).toStrictEqual([
      { limit: 1200, period: "day", seconds: 1200 },
      { limit: 5220, period: "month", seconds: 720 },
    ]);

    expect(hold({ tier: "plus", usedThisMonth: 5130 })).toStrictEqual({
      heldSeconds: 90,
      shortenedBy: "month",
    });

    // The free plan's month is a fraction of Plus's.
    expect(hold({ tier: "free", usedThisMonth: 210 })).toStrictEqual({
      heldSeconds: 90,
      shortenedBy: "month",
    });
  });

  it("has nothing to cap for uses that don't run for a time", () => {
    expect(
      getCallTimeLeft({ kind: "lessonStart", tier: "plus", usedThisMonth: 0, usedToday: 0 }),
    ).toBeNull();
  });
});

describe("the plan's call time", () => {
  const claim = { costMicros: 0, generated: false, kind: "conversation", now: NOW } as const;

  it("refuses a call once less than a minute of the day's call time is left", () => {
    expect(
      evaluateUsage({ ...claim, counts: counts({ secondsToday: 60 }), tier: "free" }),
    ).toStrictEqual({ status: "allowed" });

    expect(
      evaluateUsage({ ...claim, counts: counts({ secondsToday: 61 }), tier: "free" }),
    ).toStrictEqual({
      limit: { limit: 120, period: "day", resource: "callSeconds", tier: "free" },
      status: "limitReached",
    });
  });

  it("refuses a call once less than a minute of the month's call time is left, whatever today's", () => {
    expect(
      evaluateUsage({ ...claim, counts: counts({ secondsThisMonth: 241 }), tier: "free" }),
    ).toStrictEqual({
      limit: { limit: 300, period: "month", resource: "callSeconds", tier: "free" },
      status: "limitReached",
    });

    expect(
      evaluateUsage({ ...claim, counts: counts({ secondsThisMonth: 5161 }), tier: "plus" }),
    ).toStrictEqual({
      limit: { limit: 5220, period: "month", resource: "callSeconds", tier: "plus" },
      status: "limitReached",
    });

    expect(
      evaluateUsage({ ...claim, counts: counts({ secondsThisMonth: 5160 }), tier: "plus" }),
    ).toStrictEqual({ status: "allowed" });
  });

  it("names the month when both run out, since tomorrow brings no calls back", () => {
    // On the 1st, today's calls are the month's too: the day's cap is further past than the month's.
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

  it("keeps a month of Plus's calls within $6 even if every call is a minute long", () => {
    const monthSeconds = getUsageRule({ kind: "conversation", tier: "plus" }).monthSeconds ?? 0;

    // A one-minute call: its minute, the 10 seconds past its end before the app hangs up, and its
    // checks.
    const oneMinuteCall = getEstimatedCostMicros({
      generated: false,
      kind: "conversation",
      seconds: 70,
    });

    expect((monthSeconds / 60) * oneMinuteCall).toBeLessThanOrEqual(6_000_000);
    expect((monthSeconds / 60 + 1) * oneMinuteCall).toBeGreaterThan(6_000_000);
  });
});
