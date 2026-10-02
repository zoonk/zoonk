import { describe, expect, it } from "vitest";
import { readRefusedLimit } from "./refused-limit";

function limitReached(limit: object) {
  return {
    error: {
      code: "USAGE_LIMIT_REACHED",
      details: { limit },
      message: "This plan's limit is reached",
    },
  };
}

describe(readRefusedLimit, () => {
  it("reads which cap it was and when it starts over", () => {
    expect(
      readRefusedLimit({
        body: limitReached({ limit: 40, period: "month", resource: "lessonStart", tier: "free" }),
        status: 402,
      }),
    ).toStrictEqual({ period: "month", status: "limitReached", tier: "free" });

    expect(
      readRefusedLimit({
        body: limitReached({
          limit: 1,
          period: "total",
          resource: "generatedLessons",
          tier: "guest",
        }),
        status: 403,
      }),
    ).toStrictEqual({ period: "total", status: "limitReached", tier: "guest" });
  });

  it("tells a short break from Plus's cap for today", () => {
    expect(
      readRefusedLimit({
        body: { error: { code: "SLOW_DOWN", details: { retryAfterSeconds: 120 } } },
        status: 429,
      }),
    ).toStrictEqual({ retryAfterSeconds: 120, status: "slowDown" });

    expect(
      readRefusedLimit({
        body: limitReached({ limit: 30_000_000, period: "day", resource: "aiSpend", tier: "plus" }),
        status: 429,
      }),
    ).toStrictEqual({ period: "day", status: "limitReached", tier: "plus" });
  });

  it("falls back on the status when the body doesn't say", () => {
    expect(readRefusedLimit({ body: null, status: 403 })).toStrictEqual({
      period: "day",
      status: "limitReached",
      tier: "guest",
    });

    expect(readRefusedLimit({ body: "Payment required", status: 402 })).toStrictEqual({
      period: "day",
      status: "limitReached",
      tier: "free",
    });
  });

  it.each([200, 202, 401, 404, 409, 500])("isn't a limit when the API answered %i", (status) => {
    expect(readRefusedLimit({ body: limitReached({ tier: "free" }), status })).toBeNull();
  });
});
