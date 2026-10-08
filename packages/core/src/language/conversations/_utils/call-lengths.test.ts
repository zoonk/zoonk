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

  it("offers only what's left of today's or this month's call time", () => {
    expect(lengths({ tier: "free", usedThisMonth: 50, usedToday: 50 })).toStrictEqual({
      defaultMinutes: 1,
      limit: null,
      minutes: [1],
      plusMinutes: [3, 5],
    });

    expect(lengths({ tier: "free", usedThisMonth: 200 })).toStrictEqual({
      defaultMinutes: 1,
      limit: null,
      minutes: [1],
      plusMinutes: [3, 5],
    });
  });

  it("says until when calls come back once no length fits", () => {
    expect(lengths({ tier: "free", usedThisMonth: 90, usedToday: 90 })).toStrictEqual({
      defaultMinutes: 2,
      limit: { period: "day", tier: "free" },
      minutes: [],
      plusMinutes: [],
    });

    expect(lengths({ tier: "free", usedThisMonth: 280 })).toStrictEqual({
      defaultMinutes: 2,
      limit: { period: "month", tier: "free" },
      minutes: [],
      plusMinutes: [],
    });
  });

  it("offers Plus every length that fits, none locked", () => {
    expect(lengths({ tier: "plus" })).toStrictEqual({
      defaultMinutes: 2,
      limit: null,
      minutes: [1, 2, 3, 5],
      plusMinutes: [],
    });

    expect(lengths({ tier: "plus", usedToday: 1050 })).toStrictEqual({
      defaultMinutes: 2,
      limit: null,
      minutes: [1, 2],
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
