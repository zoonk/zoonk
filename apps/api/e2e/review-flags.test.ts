import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { sourceChangeNoticeFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { createAuthenticatedApiContext } from "./helpers/auth";
import { createBearerAdmin } from "./helpers/bearer";

/** An open flag on a question built on a source that changed; no model runs to rewrite it. */
async function openFlag() {
  const [source, skill] = await Promise.all([sourceFixture(), skillFixture()]);

  const [item, notice] = await Promise.all([
    itemFixture({ skillId: skill.id, sourceId: source.id }),
    sourceChangeNoticeFixture({ sourceId: source.id }),
  ]);

  return prisma.contentReviewFlag.create({ data: { itemId: item.id, noticeId: notice.id } });
}

test.describe("Review flag rewrites API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("is for admins only", async () => {
    const [anonymous, { apiContext }, flag] = await Promise.all([
      request.newContext({ baseURL }),
      createAuthenticatedApiContext({ baseURL, prefix: "review-flag-learner" }),
      openFlag(),
    ]);

    const [signedOut, learner] = await Promise.all([
      anonymous.post(`/v1/library/review-flags/${flag.id}/rewrites`),
      apiContext.post(`/v1/library/review-flags/${flag.id}/rewrites`),
    ]);

    expect([signedOut.status(), learner.status()]).toStrictEqual([401, 403]);

    await Promise.all([anonymous.dispose(), apiContext.dispose()]);
  });

  test("starts the rewrite of an open flag for an admin", async () => {
    const [apiContext, flag] = await Promise.all([
      createBearerAdmin({ baseURL, prefix: "review-flag-admin" }),
      openFlag(),
    ]);

    const [started, unknown, invalid] = await Promise.all([
      apiContext.post(`/v1/library/review-flags/${flag.id}/rewrites`),
      apiContext.post(`/v1/library/review-flags/${randomUUID()}/rewrites`),
      apiContext.post("/v1/library/review-flags/not-a-uuid/rewrites"),
    ]);

    expect(started.status()).toBe(202);
    expect(await started.json()).toMatchObject({ runId: expect.any(String) });
    expect(unknown.status()).toBe(404);
    expect(invalid.status()).toBe(400);

    await apiContext.dispose();
  });
});
