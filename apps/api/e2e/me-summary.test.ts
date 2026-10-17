import { request } from "@playwright/test";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { createBearerLearner, createGuest } from "./helpers/bearer";

test.describe("Learner summary API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test("refuses a caller without a session", async () => {
    const api = await request.newContext({ baseURL });
    const response = await api.get("/v1/me/summary");

    expect(response.status()).toBe(401);
    await api.dispose();
  });

  test("reads a learner's goals and identity, never from an HTTP cache", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "summary" });
    const goal = await goalFixture({ timezone: "UTC", title: "Bake sourdough bread", userId });
    await learningProfileFixture({ activeGoalId: goal.id, userId });

    const response = await api.get("/v1/me/summary");

    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("private, no-store");

    await expect(response.json()).resolves.toMatchObject({
      summary: {
        activeGoalId: goal.id,
        goals: [{ id: goal.id, isActive: true, title: "Bake sourdough bread" }],
        identity: { isAnonymous: false, userId },
        tier: "free",
        timeZone: "UTC",
      },
    });

    await api.dispose();
  });

  test("reads a guest's summary", async () => {
    const { guestApi } = await createGuest(baseURL);
    const response = await guestApi.get("/v1/me/summary");

    await expect(response.json()).resolves.toMatchObject({
      summary: { goals: [], identity: { isAnonymous: true }, tier: "guest" },
    });

    await guestApi.dispose();
  });
});
