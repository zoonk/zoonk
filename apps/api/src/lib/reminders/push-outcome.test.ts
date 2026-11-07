import { describe, expect, it } from "vitest";
import { classifyApnsAnswer, classifyFcmAnswer } from "./push-outcome";

describe(classifyApnsAnswer, () => {
  it.each([
    [{ reason: null, retryAfter: null, status: 200 }, { status: "sent" }],
    [{ reason: "Unregistered", retryAfter: null, status: 410 }, { status: "gone" }],
    [{ reason: "BadDeviceToken", retryAfter: null, status: 400 }, { status: "gone" }],
    [{ reason: "BadCollapseId", retryAfter: null, status: 400 }, { status: "unknown" }],
    [
      { reason: "TooManyRequests", retryAfter: "5", status: 429 },
      { retryAfterMs: 5000, status: "retry" },
    ],
    [{ reason: "ServiceUnavailable", retryAfter: null, status: 503 }, { status: "unknown" }],
  ])("reads %o as %o", (answer, outcome) => {
    expect(classifyApnsAnswer(answer)).toStrictEqual(outcome);
  });
});

describe(classifyFcmAnswer, () => {
  it.each([
    [{ retryAfter: null, status: 200 }, { status: "sent" }],
    [{ retryAfter: null, status: 404 }, { status: "gone" }],
    [{ retryAfter: null, status: 400 }, { status: "unknown" }],
    [
      { retryAfter: "10", status: 503 },
      { retryAfterMs: 10_000, status: "retry" },
    ],
    [
      { retryAfter: null, status: 429 },
      { retryAfterMs: 60_000, status: "retry" },
    ],
    [{ retryAfter: null, status: 500 }, { status: "unknown" }],
  ])("reads %o as %o", (answer, outcome) => {
    expect(classifyFcmAnswer(answer)).toStrictEqual(outcome);
  });
});

describe("Retry-After", () => {
  it("reads an HTTP date as well as seconds", () => {
    const outcome = classifyFcmAnswer({
      retryAfter: new Date(Date.now() + 30_000).toUTCString(),
      status: 503,
    });

    expect(outcome).toMatchObject({ retryAfterMs: expect.any(Number), status: "retry" });
    expect(outcome.status === "retry" && outcome.retryAfterMs).toBeGreaterThan(25_000);
  });
});
