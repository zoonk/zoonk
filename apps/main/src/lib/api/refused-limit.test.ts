import { describe, expect, it } from "vitest";
import { readRefusedLessonLimit, readRefusedLimit } from "./refused-limit";

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
        body: limitReached({ limit: 40, period: "month", resource: "mindMap", tier: "free" }),
        status: 402,
      }),
    ).toStrictEqual({ period: "month", status: "limitReached", tier: "free" });

    expect(
      readRefusedLessonLimit({
        body: limitReached({
          availableAt: "2026-11-20T12:00:00.000Z",
          limit: 20,
          period: "rolling30Days",
          resource: "lessonStart",
          tier: "free",
        }),
        status: 402,
      }),
    ).toStrictEqual({
      availableAt: "2026-11-20T12:00:00.000Z",
      period: "rolling30Days",
      status: "limitReached",
      tier: "free",
    });

    expect(
      readRefusedLessonLimit({
        body: limitReached({ limit: 200, period: "day", resource: "lessonStart", tier: "plus" }),
        status: 429,
      }),
    ).toStrictEqual({ period: "day", status: "limitReached", tier: "plus" });

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

  it("asks a guest to create an account once the guests' daily AI budget is spent", () => {
    expect(
      readRefusedLimit({
        body: {
          error: { code: "SIGN_UP_REQUIRED", message: "Create your free account to continue" },
        },
        status: 403,
      }),
    ).toStrictEqual({ status: "signUpRequired" });
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
