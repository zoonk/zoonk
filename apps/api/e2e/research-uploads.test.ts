import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import {
  goalUploadRequestResponseSchema,
  researchResourceSchema,
} from "../src/lib/openapi/schemas/research-sources";
import { createBearerLearner } from "./helpers/bearer";
import { readBody } from "./helpers/response";
import { privateUploadFixture } from "./helpers/sources";

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
      request: {
        examDocument: "notice",
        goalId: goal.id,
        goalKind: "exam",
        language: "en",
        reason: "noOfficialSource",
        unreadableUpload: null,
      },
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

  test("requires newly readable material to answer a reopened upload request", async () => {
    const learner = await createBearerLearner({ baseURL, prefix: "upload-unreadable" });

    const [goal, photo, priorUpload] = await Promise.all([
      examGoalWaitingForNotice(learner.userId),
      sourceFixture({
        kind: "upload",
        mimeType: "image/png",
        ownerId: learner.userId,
        readState: "read",
        title: "Blurry notes",
        visibility: "private",
      }),
      privateUploadFixture({ ownerId: learner.userId }),
    ]);

    await Promise.all([
      learnerSourceFixture({ sourceId: photo.id, userId: learner.userId }),
      learnerSourceFixture({ sourceId: priorUpload.id, userId: learner.userId }),
    ]);

    await prisma.goalSource.create({
      data: { answeredAt: new Date(), goalId: goal.id, origin: "upload", sourceId: priorUpload.id },
    });

    const data = { goalId: goal.id, sourceIds: [priorUpload.id, photo.id] };
    const refused = await learner.api.post("/v1/research", { data });
    expect(refused.status()).toBe(422);
    await expect(refused.json()).resolves.toMatchObject({ error: { code: "UPLOAD_UNREADABLE" } });

    await expect(
      prisma.goalSource.count({ where: { goalId: goal.id, sourceId: photo.id } }),
    ).resolves.toBe(0);

    await prisma.source.update({ data: { readState: "owed" }, where: { id: photo.id } });

    const accepted = await readBody({
      response: await learner.api.post("/v1/research", { data }),
      schema: researchResourceSchema,
      status: 202,
    });

    await prisma.source.update({ data: { readState: "read" }, where: { id: photo.id } });

    await expect
      .poll(async () => {
        const run = await readBody({
          response: await learner.api.get(`/v1/research/${accepted.id}`),
          schema: researchResourceSchema,
        });

        return run.result;
      })
      .toEqual({ reason: "noOfficialSource", status: "needsUpload" });

    const reopened = await readBody({
      response: await learner.api.get(`/v1/goals/${goal.id}/upload-request`),
      schema: goalUploadRequestResponseSchema,
    });

    expect(reopened).toMatchObject({
      request: { reason: "noOfficialSource", unreadableUpload: { title: "Blurry notes" } },
    });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      researchRunId: null,
      researchUploadReason: "noOfficialSource",
    });

    await learner.api.dispose();
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

    await Promise.all([
      learnerSourceFixture({ goalId: goal.id, sourceId: upload.id, userId: learner.userId }),
      learnerSourceFixture({ sourceId: othersUpload.id, userId: other.userId }),
    ]);

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

    const anonymous = await request.newContext({ baseURL });

    const run = await readBody({
      response: await anonymous.get(`/v1/research/${research.id}`),
      schema: researchResourceSchema,
    });

    expect(run.id).toBe(research.id);
    await anonymous.dispose();

    const [ask, link] = await Promise.all([
      learner.api.get(`/v1/goals/${goal.id}/upload-request`),
      prisma.goalSource.findFirst({ where: { goalId: goal.id, sourceId: upload.id } }),
    ]);

    expect(goalUploadRequestResponseSchema.parse(await ask.json())).toStrictEqual({
      request: null,
    });

    expect(link).toMatchObject({ answeredAt: expect.any(Date), origin: "upload" });

    const again = await learner.api.post("/v1/research", {
      data: { goalId: goal.id, sourceIds: [upload.id] },
    });

    expect(again.status()).toBe(409);
    await Promise.all([learner.api.dispose(), other.api.dispose()]);
  });
});
