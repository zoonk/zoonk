import { request } from "@playwright/test";
import { expect, test } from "@zoonk/e2e/fixtures";

test.describe("Learning profile API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test("rejects requests without a session", async () => {
    const api = await request.newContext({ baseURL });

    const responses = await Promise.all([
      api.get("/v1/me/learning-profile"),
      api.get("/v1/me/allowance"),
      api.get("/v1/me/daily-time-limit"),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual([401, 401, 401]);
    await api.dispose();
  });
});
