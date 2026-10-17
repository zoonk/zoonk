import { request } from "@playwright/test";
import { expect, test } from "@zoonk/e2e/fixtures";
import { createBearerLearner } from "./helpers/bearer";

const PATH = "/cron/daily-sweeps";

/**
 * Only Vercel Cron, with the deployment's secret, may start the daily sweeps. Starting them runs a
 * durable workflow over every learner's data, so the accepted request isn't exercised here.
 */
test.describe("Daily sweeps cron", () => {
  test("refuses requests without the cron secret, signed in or not", async () => {
    const baseURL = process.env.E2E_BASE_URL ?? "";

    const [anonymous, learner] = await Promise.all([
      request.newContext({ baseURL }),
      createBearerLearner({ baseURL, prefix: "cron" }),
    ]);

    const responses = await Promise.all([
      anonymous.get(PATH),
      anonymous.get(PATH, { headers: { Authorization: "Bearer not-the-secret" } }),
      learner.api.get(PATH),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual([401, 401, 401]);
    await Promise.all([anonymous.dispose(), learner.api.dispose()]);
  });
});
