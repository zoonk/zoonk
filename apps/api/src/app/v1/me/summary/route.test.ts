import { learnerSummaryResponseSchema } from "@/lib/openapi/schemas/learner-summary";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockAccountSession } from "../../../../../../../packages/core/src/_test-utils/mock-session";
import { GET as getSummary } from "./route";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));

describe("GET /v1/me/summary consent", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns an estimated exam date and its days left in the public goal summary", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T01:30:00Z"));

    const user = await userFixture();
    mockAccountSession({ user });

    const goal = await goalFixture({
      createdAt: new Date("2026-01-01T00:00:00Z"),
      details: { examMonth: 11, examYear: 2026 },
      kind: "exam",
      targetDate: new Date("2026-11-01T00:00:00Z"),
      timezone: "America/Sao_Paulo",
      userId: user.id,
    });

    const response = await getSummary(new Request("http://localhost/v1/me/summary"));
    expect(response.status).toBe(200);
    const body = learnerSummaryResponseSchema.parse(await response.json());

    expect(body.summary.goals.find((item) => item.id === goal.id)).toMatchObject({
      daysLeft: 1,
      targetDateEstimated: true,
    });
  });

  it.each([
    { choice: null, country: "DE", expected: null },
    { choice: null, country: "US", expected: true },
    { choice: false, country: "US", expected: false },
    { choice: true, country: "DE", expected: true },
  ])(
    "resolves $choice in $country outside the cached summary",
    async ({ choice, country, expected }) => {
      const user = await userFixture();
      mockAccountSession({ user });
      await learningProfileFixture({ shareUsageData: choice, userId: user.id });

      const response = await getSummary(
        new Request("http://localhost/v1/me/summary", {
          headers: { "x-vercel-ip-country": country },
        }),
      );

      expect(response.status).toBe(200);
      const body = learnerSummaryResponseSchema.parse(await response.json());
      expect(body.summary.analytics.usageDataSharing).toBe(expected);
      expect(body).not.toHaveProperty("usageDataSharing");
      expect(body.summary.analytics.shareUsageData).toBe(choice);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    },
  );
});
