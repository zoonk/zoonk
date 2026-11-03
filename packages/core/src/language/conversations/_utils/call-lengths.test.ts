import { describe, expect, it } from "vitest";
import { getCallTimeLeft } from "../../../entitlements/_utils/evaluate-usage";
import { toPracticeCallLengths } from "./call-lengths";

function lengths({
  tier,
  usedThisMonth = 0,
  usedToday = 0,
}: {
  tier: "free" | "guest" | "plus";
  usedThisMonth?: number;
  usedToday?: number;
}) {
  return toPracticeCallLengths({
    left: getCallTimeLeft({ kind: "conversation", tier, usedThisMonth, usedToday }),
    tier,
  });
}

describe(toPracticeCallLengths, () => {
  it("offers a free learner the lengths their day fits, and the longer ones locked with Plus", () => {
    expect(lengths({ tier: "free" })).toStrictEqual({
      defaultMinutes: 2,
      limit: null,
      minutes: [1, 2],
      plusMinutes: [3, 5],
    });
  });

  it("offers every length the plan allows while any of today's and this month's call time is left", () => {
    const free = { defaultMinutes: 2, limit: null, minutes: [1, 2], plusMinutes: [3, 5] };

    expect([
      lengths({ tier: "free", usedThisMonth: 110, usedToday: 110 }),
      lengths({ tier: "free", usedThisMonth: 290 }),
    ]).toStrictEqual([free, free]);
  });

  it("says until when calls come back once no call time is left", () => {
    expect(lengths({ tier: "free", usedThisMonth: 120, usedToday: 120 })).toStrictEqual({
      defaultMinutes: 2,
      limit: { period: "day", tier: "free" },
      minutes: [],
      plusMinutes: [],
    });

    expect(lengths({ tier: "free", usedThisMonth: 300 })).toStrictEqual({
      defaultMinutes: 2,
      limit: { period: "month", tier: "free" },
      minutes: [],
      plusMinutes: [],
    });
  });

  it("offers Plus every length, none locked, while any call time is left", () => {
    expect(lengths({ tier: "plus" })).toStrictEqual({
      defaultMinutes: 2,
      limit: null,
      minutes: [1, 2, 3, 5],
      plusMinutes: [],
    });

    expect(lengths({ tier: "plus", usedToday: 1190 })).toStrictEqual({
      defaultMinutes: 2,
      limit: null,
      minutes: [1, 2, 3, 5],
      plusMinutes: [],
    });
  });

  it("tells a guest calls come with a free account", () => {
    expect(lengths({ tier: "guest" })).toStrictEqual({
      defaultMinutes: 2,
      limit: { period: "total", tier: "guest" },
      minutes: [],
      plusMinutes: [],
    });
  });
});
