import { conversationRefusalError } from "@/lib/language-errors";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { allowanceResponseSchema } from "@/lib/openapi/schemas/allowance";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockAccountSession } from "../../../../../../../packages/core/src/_test-utils/mock-session";
import { GET as getAllowanceResponse } from "./route";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));

describe("rolling allowances", () => {
  afterEach(() => vi.useRealTimers());

  it("serializes a shared rolling allowance without calendar reset fields", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-12-01T12:00:00Z"));
    const user = await userFixture();
    mockAccountSession({ user });

    await usageRecordsFixture({
      count: 10,
      createdAt: new Date("2026-11-29T12:00:00Z"),
      kind: "mindMap",
      userId: user.id,
    });

    const response = await getAllowanceResponse();

    expect(response.status).toBe(200);
    const json = await response.json();
    const body = allowanceResponseSchema.parse(json);

    expect(body.items.find((item) => item.kind === "mindMap")).toMatchObject({
      availableAt: "2026-12-29T12:00:00.000Z",
      remaining: 0,
      rollingLimit: 10,
      usedLast30Days: 10,
    });

    expect(json).not.toHaveProperty("callTime");
    expect(json).not.toHaveProperty("resets.month");

    expect(
      body.items.every(
        (item) => "rollingLimit" in item && "usedLast30Days" in item && "availableAt" in item,
      ),
    ).toBe(true);
  });

  it.each(["callSeconds", "aiSpend"] as const)(
    "preserves the call refusal shape for rolling %s",
    async (resource) => {
      const availableAt = new Date("2026-12-20T12:00:00Z");

      const response = conversationRefusalError({
        limit: { availableAt, limit: 300, period: "rolling30Days", resource, tier: "free" },
        status: "limitReached",
      });

      expect(response?.status).toBe(429);

      await expect(response?.json()).resolves.toMatchObject({
        error: {
          code: "CONVERSATION_LIMIT_REACHED",
          details: { availableAt: availableAt.toISOString(), period: "rolling30Days", resource },
        },
      });
    },
  );

  it.each([
    ["free", 402],
    ["guest", 403],
    ["plus", 429],
  ] as const)("preserves %s usage status and serializes the date", async (tier, status) => {
    const availableAt = new Date("2026-12-20T12:00:00Z");

    const response = usageDecisionError({
      limit: { availableAt, limit: 10, period: "rolling30Days", resource: "mindMap", tier },
      status: "limitReached",
    });

    expect(response.status).toBe(status);

    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "USAGE_LIMIT_REACHED",
        details: { limit: { availableAt: availableAt.toISOString(), period: "rolling30Days" } },
      },
    });
  });
});
