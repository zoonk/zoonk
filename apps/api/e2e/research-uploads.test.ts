import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  goalUploadRequestResponseSchema,
  researchResourceSchema,
} from "../src/lib/openapi/schemas/research-sources";
import { createBearerLearner } from "./helpers/bearer";
import { readBody } from "./helpers/response";
import { privateUploadFixture } from "./helpers/sources";

/** An exam goal whose research couldn't find the official notice. */
function examGoalWaitingForNotice(userId: string) {
  return goalFixture({
    kind: "exam",
    researchUploadReason: "noOfficialSource",
    title: "Concurso TCDF",
    userId,
  });
}

test.describe("Research upload requests API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication", async () => {
    const api = await request.newContext({ baseURL });
    const path = `/v1/goals/${randomUUID()}/upload-request`;

    const responses = await Promise.all([api.get(path), api.delete(path)]);

    expect(responses.map((response) => response.status())).toStrictEqual([401, 401]);
    await api.dispose();
  });

  test("reads a research run that exists, by its id", async () => {
    const anonymous = await request.newContext({ baseURL });

    const [unknown, garbled, blank] = await Promise.all([
      anonymous.get(`/v1/research/wrun_${randomUUID()}`),
      anonymous.get("/v1/research/not-a-run"),
      anonymous.get("/v1/research/%20"),
    ]);

    expect([unknown.status(), garbled.status(), blank.status()]).toStrictEqual([404, 404, 400]);
    await anonymous.dispose();
  });

  test("shows the ask only to its learner, and dismissing takes it away", async () => {
    const [learner, other] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "upload-ask" }),
      createBearerLearner({ baseURL, prefix: "upload-ask-other" }),
    ]);

    const goal = await examGoalWaitingForNotice(learner.userId);
    const path = `/v1/goals/${goal.id}/upload-request`;

    const [own, hidden, hiddenDismissal] = await Promise.all([
      learner.api.get(path),
      other.api.get(path),
      other.api.delete(path),
    ]);

    expect(own.status()).toBe(200);

    expect(goalUploadRequestResponseSchema.parse(await own.json())).toStrictEqual({
      request: { goalId: goal.id, goalKind: "exam", language: "en", reason: "noOfficialSource" },
    });

    expect([hidden.status(), hiddenDismissal.status()]).toStrictEqual([404, 404]);

    const dismissal = await learner.api.delete(path);
    expect(dismissal.status()).toBe(204);

    const after = await learner.api.get(path);

    expect(goalUploadRequestResponseSchema.parse(await after.json())).toStrictEqual({
      request: null,
    });

    await Promise.all([learner.api.dispose(), other.api.dispose()]);
  });

  test("answers the ask with the learner's upload and starts research with it", async () => {
    const [learner, other] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "upload-answer" }),
      createBearerLearner({ baseURL, prefix: "upload-answer-other" }),
    ]);

    const [goal, upload, othersUpload] = await Promise.all([
      examGoalWaitingForNotice(learner.userId),
      privateUploadFixture({ ownerId: learner.userId }),
      privateUploadFixture({ ownerId: other.userId }),
    ]);

    // Someone else's upload is never read.
    const refused = await learner.api.post("/v1/research", {
      data: { goalId: goal.id, sourceIds: [othersUpload.id] },
    });

    expect(refused.status()).toBe(404);

    const started = await learner.api.post("/v1/research", {
      data: { goalId: goal.id, sourceIds: [upload.id] },
    });

    expect(started.status()).toBe(202);
    const research = researchResourceSchema.parse(await started.json());
    expect(research).toMatchObject({ result: null });

    // The unguessable run id is the capability, so the run reads without a session.
    const anonymous = await request.newContext({ baseURL });

    const run = await readBody({
      response: await anonymous.get(`/v1/research/${research.id}`),
      schema: researchResourceSchema,
    });

    expect(run.id).toBe(research.id);
    await anonymous.dispose();

    const [ask, link] = await Promise.all([
      learner.api.get(`/v1/goals/${goal.id}/upload-request`),
      prisma.learnerSource.findFirst({ where: { sourceId: upload.id, userId: learner.userId } }),
    ]);

    expect(goalUploadRequestResponseSchema.parse(await ask.json())).toStrictEqual({
      request: null,
    });

    expect(link).toMatchObject({ goalId: goal.id, origin: "upload" });

    // The ask is answered: another upload can't rebuild the goal again.
    const again = await learner.api.post("/v1/research", {
      data: { goalId: goal.id, sourceIds: [upload.id] },
    });

    expect(again.status()).toBe(409);
    await Promise.all([learner.api.dispose(), other.api.dispose()]);
  });
});
