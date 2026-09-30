import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { createAuthenticatedApiContext } from "./helpers/auth";
import { createBearerAdmin } from "./helpers/bearer";

const HOUR_MS = 3_600_000;
const PATH = "/v1/freshness/commands";

test.describe("Freshness commands API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("is for admins only", async () => {
    const [anonymous, { apiContext }, exam] = await Promise.all([
      request.newContext({ baseURL }),
      createAuthenticatedApiContext({ baseURL, prefix: "freshness-learner" }),
      examBlueprintFixture(),
    ]);

    const data = { command: "checkNow", target: { examBlueprintId: exam.id, kind: "exam" } };

    const [signedOut, learner] = await Promise.all([
      anonymous.post(PATH, { data }),
      apiContext.post(PATH, { data }),
    ]);

    expect([signedOut.status(), learner.status()]).toStrictEqual([401, 403]);

    await Promise.all([anonymous.dispose(), apiContext.dispose()]);
  });

  test("stops an exam's or source's checks and starts a check now", async () => {
    const nextCheckAt = new Date(Date.now() + HOUR_MS);

    const [apiContext, exam, source] = await Promise.all([
      createBearerAdmin({ baseURL, prefix: "freshness-admin" }),
      examBlueprintFixture({ nextCheckAt }),
      sourceFixture({ nextCheckAt }),
    ]);

    const [stoppedExam, stoppedSource, checked, unknown] = await Promise.all([
      apiContext.post(PATH, {
        data: { command: "stop", target: { examBlueprintId: exam.id, kind: "exam" } },
      }),
      apiContext.post(PATH, {
        data: { command: "stop", target: { kind: "source", sourceId: source.id } },
      }),
      apiContext.post(PATH, {
        data: { command: "checkNow", target: { kind: "source", sourceId: source.id } },
      }),
      apiContext.post(PATH, {
        data: { command: "checkNow", target: { examBlueprintId: randomUUID(), kind: "exam" } },
      }),
    ]);

    expect(await stoppedExam.json()).toStrictEqual({ status: "stopped" });
    expect(await stoppedSource.json()).toStrictEqual({ status: "stopped" });
    expect(await checked.json()).toStrictEqual({ status: "started" });
    expect(unknown.status()).toBe(404);

    await expect(
      prisma.examBlueprint.findUniqueOrThrow({ where: { id: exam.id } }),
    ).resolves.toMatchObject({ nextCheckAt: null });

    await apiContext.dispose();
  });
});
