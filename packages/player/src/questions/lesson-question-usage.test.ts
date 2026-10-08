import { describe, expect, it } from "vitest";
import { getRefusalError } from "./lesson-question-usage";

function limitReachedBody(tier: string) {
  return {
    error: {
      code: "USAGE_LIMIT_REACHED",
      details: { limit: { limit: 10, period: "day", resource: "tutorMessage", tier } },
      message: "",
    },
  };
}

function refusal({ body, status }: { body: unknown; status: number }) {
  return getRefusalError(Response.json(body, { status }));
}

describe(getRefusalError, () => {
  it("asks the learner to slow down with the wait the server gives", async () => {
    await expect(
      refusal({
        body: { error: { code: "SLOW_DOWN", details: { retryAfterSeconds: 30 }, message: "" } },
        status: 429,
      }),
    ).resolves.toStrictEqual({ kind: "slowDown", retryAfterSeconds: 30 });
  });

  it("reads which plan's tutor allowance ran out", async () => {
    await expect(refusal({ body: limitReachedBody("guest"), status: 403 })).resolves.toStrictEqual({
      kind: "usageLimit",
      period: "day",
      tier: "guest",
    });

    await expect(refusal({ body: limitReachedBody("free"), status: 402 })).resolves.toStrictEqual({
      kind: "usageLimit",
      period: "day",
      tier: "free",
    });
  });

  it("asks for a plan when access needs one and treats other refusals as unknown", async () => {
    await expect(
      refusal({ body: { error: { code: "PAYMENT_REQUIRED", message: "" } }, status: 402 }),
    ).resolves.toStrictEqual({ kind: "subscription" });

    await expect(refusal({ body: null, status: 403 })).resolves.toStrictEqual({ kind: "unknown" });
    await expect(refusal({ body: null, status: 429 })).resolves.toStrictEqual({ kind: "unknown" });
  });
});
