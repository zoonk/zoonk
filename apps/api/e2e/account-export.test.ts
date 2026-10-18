import { request } from "@playwright/test";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { createBearerLearner } from "./helpers/bearer";

test.describe("Account data export API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test("requires authentication", async () => {
    const api = await request.newContext({ baseURL });
    const response = await api.get("/v1/me/export");

    expect(response.status()).toBe(401);
    await api.dispose();
  });

  test("downloads the learner's own data as a JSON attachment", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "account-export" });

    await Promise.all([
      goalFixture({ title: "Speak Spanish at work", userId }),
      memoryFactFixture({ statement: "Works in sales", userId }),
      api.patch("/v1/me/learning-profile", { data: { buddy: { kind: "otto" } } }),
    ]);

    const response = await api.get("/v1/me/export");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-disposition"]).toMatch(/attachment; filename="zoonk-data-/u);

    await expect(response.json()).resolves.toMatchObject({
      buddy: { conversations: [], exampleLines: [] },
      goals: [expect.objectContaining({ title: "Speak Spanish at work", userId })],
      memory: { facts: [expect.objectContaining({ statement: "Works in sales" })] },
      profile: { buddy: { kind: "otto" } },
    });

    await api.dispose();
  });
});
