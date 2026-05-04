import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { expect, test } from "@zoonk/e2e/fixtures";

test.describe("Feedback API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test("accepts a feedback message", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.post("/v1/feedback", {
      data: {
        email: `e2e-feedback-${uniqueId}@zoonk.test`,
        message: `Native client feedback message ${uniqueId}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.message).toBe("Feedback received");

    await apiContext.dispose();
  });

  test("returns validation error for missing message", async () => {
    const apiContext = await request.newContext({ baseURL });

    const response = await apiContext.post("/v1/feedback", {
      data: { email: "e2e-feedback-invalid@zoonk.test" },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();

    expect(body.error.code).toBe("VALIDATION_ERROR");

    await apiContext.dispose();
  });
});
