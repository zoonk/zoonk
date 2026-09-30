import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  examBlueprintFixture,
  learnerSourceFixture,
  sourceChangeNoticeFixture,
  sourceFixture,
} from "@zoonk/testing/fixtures/sources";
import {
  changeNoticesResponseSchema,
  learnerSourcesResponseSchema,
  sourceResourceSchema,
  uploadResourceSchema,
} from "../src/lib/openapi/schemas/research-sources";
import { createBearerLearner, createGuest } from "./helpers/bearer";
import { readBody } from "./helpers/response";
import { privateUploadFixture } from "./helpers/sources";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * HOUR_MS);
}

/** A file the learner says they uploaded to Blob storage, by its pathname. */
function uploadedFile(pathname: string) {
  return { kind: "file", language: "en", pathname };
}

/** What Vercel Blob's `uploadPresigned()` sends to sign one file's upload. */
function uploadTokenRequest(pathname: string) {
  return {
    payload: { clientPayload: null, multipart: false, pathname },
    type: "blob.generate-presigned-url",
  };
}

function materialQuestion(sourceIds: string[]) {
  return { language: "pt", question: "Quantas questões tem a prova?", sourceIds };
}

function pastedText(goalId: string | null) {
  return {
    goalId,
    kind: "text",
    language: "en",
    text: `Class notes ${randomUUID()}: mitochondria make the cell's energy.`,
    title: "Biology notes",
  };
}

test.describe("Sources API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires a session for the learner's own material", async () => {
    const anonymous = await request.newContext({ baseURL });

    const responses = await Promise.all([
      anonymous.get("/v1/sources"),
      anonymous.post("/v1/uploads", { data: pastedText(null) }),
      anonymous.post("/v1/uploads/tokens", { data: uploadTokenRequest("sources/x/notice.pdf") }),
      anonymous.post("/v1/material-questions", {
        data: { language: "en", question: "What is this about?", sourceIds: [randomUUID()] },
      }),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual([401, 401, 401, 401]);
    await anonymous.dispose();
  });

  test("lists only the learner's own links to their material, filtered by goal", async () => {
    const [learner, other] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "sources-list" }),
      createBearerLearner({ baseURL, prefix: "sources-list-other" }),
    ]);

    const [goal, otherGoal, shared, upload] = await Promise.all([
      goalFixture({ userId: learner.userId }),
      goalFixture({ userId: other.userId }),
      sourceFixture({ title: "Civil Code" }),
      privateUploadFixture({ ownerId: learner.userId }),
    ]);

    // Both learners' research found the same public source for their own goals.
    await Promise.all([
      learnerSourceFixture({
        createdAt: hoursAgo(2),
        goalId: goal.id,
        origin: "research",
        sourceId: shared.id,
        userId: learner.userId,
      }),
      learnerSourceFixture({ createdAt: hoursAgo(1), sourceId: upload.id, userId: learner.userId }),
      learnerSourceFixture({
        goalId: otherGoal.id,
        origin: "research",
        sourceId: shared.id,
        userId: other.userId,
      }),
    ]);

    const [all, forGoal, forOthersGoal, othersList, invalid] = await Promise.all([
      learner.api.get("/v1/sources"),
      learner.api.get(`/v1/sources?goalId=${goal.id}`),
      learner.api.get(`/v1/sources?goalId=${otherGoal.id}`),
      other.api.get("/v1/sources"),
      learner.api.get("/v1/sources?goalId=not-a-goal"),
    ]);

    const allBody = await readBody({ response: all, schema: learnerSourcesResponseSchema });

    expect(allBody.sources.map((link) => [link.source.id, link.goalId, link.origin])).toStrictEqual(
      [
        [upload.id, null, "upload"],
        [shared.id, goal.id, "research"],
      ],
    );

    expect(allBody.sources[0]?.source).toMatchObject({
      kind: "upload",
      title: "My notes",
      url: null,
      visibility: "private",
    });

    // Storage details (the blob, the text, its hash and the owner) stay on the server.
    const raw = await all.json();

    expect(Object.keys(raw.sources[0].source).toSorted()).toStrictEqual(
      Object.keys(sourceResourceSchema.shape).toSorted(),
    );

    await expect(
      readBody({ response: forGoal, schema: learnerSourcesResponseSchema }),
    ).resolves.toMatchObject({ sources: [{ goalId: goal.id, source: { id: shared.id } }] });

    await expect(
      readBody({ response: forOthersGoal, schema: learnerSourcesResponseSchema }),
    ).resolves.toStrictEqual({ sources: [] });

    const othersBody = await readBody({
      response: othersList,
      schema: learnerSourcesResponseSchema,
    });

    expect(othersBody.sources.map((link) => [link.source.id, link.goalId])).toStrictEqual([
      [shared.id, otherGoal.id],
    ]);

    expect(invalid.status()).toBe(400);
    await Promise.all([learner.api.dispose(), other.api.dispose()]);
  });

  test("reads a public source for anyone and a private upload for its owner only", async () => {
    const [owner, other, anonymous] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "source-owner" }),
      createBearerLearner({ baseURL, prefix: "source-other" }),
      request.newContext({ baseURL }),
    ]);

    const [shared, upload] = await Promise.all([
      sourceFixture({ publisher: "Planalto", title: "Civil Code" }),
      privateUploadFixture({ ownerId: owner.userId }),
    ]);

    const publicSource = await readBody({
      response: await anonymous.get(`/v1/sources/${shared.id}`),
      schema: sourceResourceSchema,
    });

    expect(publicSource).toStrictEqual({
      fetchedAt: shared.fetchedAt.toISOString(),
      id: shared.id,
      kind: "official",
      language: "en",
      mimeType: null,
      publisher: "Planalto",
      reusePolicy: null,
      title: "Civil Code",
      url: shared.url,
      validUntil: null,
      visibility: "public",
    });

    const own = await readBody({
      response: await owner.api.get(`/v1/sources/${upload.id}`),
      schema: sourceResourceSchema,
    });

    expect(own).toMatchObject({ id: upload.id, url: null, visibility: "private" });

    const [hidden, hiddenFromVisitor, unknown, invalid] = await Promise.all([
      other.api.get(`/v1/sources/${upload.id}`),
      anonymous.get(`/v1/sources/${upload.id}`),
      owner.api.get(`/v1/sources/${randomUUID()}`),
      owner.api.get("/v1/sources/not-a-source"),
    ]);

    expect([hidden, hiddenFromVisitor, unknown, invalid].map((res) => res.status())).toStrictEqual([
      404, 404, 404, 400,
    ]);

    await Promise.all([owner.api.dispose(), other.api.dispose(), anonymous.dispose()]);
  });

  test("stores pasted text as private material, once, linked only to the learner's own goal", async () => {
    const [learner, other] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "upload-text" }),
      createBearerLearner({ baseURL, prefix: "upload-text-other" }),
    ]);

    const [goal, otherGoal] = await Promise.all([
      goalFixture({ userId: learner.userId }),
      goalFixture({ userId: other.userId }),
    ]);

    const pasted = pastedText(goal.id);
    const response = await learner.api.post("/v1/uploads", { data: pasted });
    const created = await readBody({ response, schema: uploadResourceSchema, status: 201 });

    expect(created).toMatchObject({
      checkingVisibility: true,
      source: {
        kind: "upload",
        language: "en",
        mimeType: "text/plain",
        title: "Biology notes",
        url: null,
        visibility: "private",
      },
    });

    // Pasting the same text again links the stored copy instead of storing it twice.
    const again = await readBody({
      response: await learner.api.post("/v1/uploads", { data: pasted }),
      schema: uploadResourceSchema,
      status: 201,
    });

    expect(again).toMatchObject({ checkingVisibility: false, source: { id: created.source.id } });

    // A goal id that isn't the learner's own stores the material without the goal.
    const unlinked = await readBody({
      response: await learner.api.post("/v1/uploads", { data: pastedText(otherGoal.id) }),
      schema: uploadResourceSchema,
      status: 201,
    });

    const [links, stored, hidden] = await Promise.all([
      learner.api.get("/v1/sources"),
      prisma.source.findUniqueOrThrow({ where: { id: created.source.id } }),
      other.api.get(`/v1/sources/${created.source.id}`),
    ]);

    const { sources } = await readBody({ response: links, schema: learnerSourcesResponseSchema });

    expect(sources.map((link) => [link.source.id, link.goalId])).toStrictEqual([
      [unlinked.source.id, null],
      [created.source.id, goal.id],
    ]);

    expect(stored).toMatchObject({ extractedText: pasted.text, ownerId: learner.userId });
    expect(hidden.status()).toBe(404);

    await Promise.all([learner.api.dispose(), other.api.dispose()]);
  });

  test("refuses uploads and upload tokens outside the learner's folder, invalid ones and a guest's", async () => {
    const [learner, other, guest] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "upload-refused" }),
      createBearerLearner({ baseURL, prefix: "upload-refused-other" }),
      createGuest(baseURL),
    ]);

    const { guestApi } = guest;

    const responses = await Promise.all([
      learner.api.post("/v1/uploads", { data: uploadedFile(`sources/${other.userId}/notice.pdf`) }),
      learner.api.post("/v1/uploads", {
        data: uploadedFile(`sources/${learner.userId}/../${other.userId}/notice.pdf`),
      }),
      learner.api.post("/v1/uploads", {
        data: uploadedFile(`images/${learner.userId}/notice.pdf`),
      }),
      learner.api.post("/v1/uploads", { data: { kind: "text", language: "en", text: "  " } }),
      learner.api.post("/v1/uploads", {
        data: { kind: "link", language: "en", url: "ftp://example.test/notice.pdf" },
      }),
      learner.api.post("/v1/uploads", { data: { language: "en", text: "Notes" } }),
      learner.api.post("/v1/uploads/tokens", {
        data: uploadTokenRequest(`sources/${other.userId}/notice.pdf`),
      }),
      learner.api.post("/v1/uploads/tokens", {
        data: { ...uploadTokenRequest(`sources/${learner.userId}/notice.pdf`), type: "upload" },
      }),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual([
      400, 400, 400, 400, 400, 400, 400, 400,
    ]);

    // Guests can't upload, so nothing is signed or stored for them.
    const [guestToken, guestUpload, stored] = await Promise.all([
      guestApi.post("/v1/uploads/tokens", {
        data: uploadTokenRequest(`sources/${guest.userId}/notice.pdf`),
      }),
      guestApi.post("/v1/uploads", { data: pastedText(null) }),
      prisma.learnerSource.count({ where: { userId: learner.userId } }),
    ]);

    expect([guestToken.status(), guestUpload.status()]).toStrictEqual([429, 429]);

    await expect(guestUpload.json()).resolves.toMatchObject({
      error: { code: "UPLOAD_LIMIT_REACHED" },
    });

    expect(stored).toBe(0);
    await Promise.all([learner.api.dispose(), other.api.dispose(), guestApi.dispose()]);
  });

  test("answers material questions only about the learner's own material", async () => {
    const [learner, other, guest] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "material-question" }),
      createBearerLearner({ baseURL, prefix: "material-question-other" }),
      createGuest(baseURL),
    ]);

    const [upload, notLinked, guestUpload] = await Promise.all([
      privateUploadFixture({ ownerId: learner.userId }),
      privateUploadFixture({ ownerId: learner.userId }),
      privateUploadFixture({ ownerId: guest.userId }),
    ]);

    await Promise.all([
      learnerSourceFixture({ sourceId: upload.id, userId: learner.userId }),
      learnerSourceFixture({ sourceId: guestUpload.id, userId: guest.userId }),
    ]);

    const [othersMaterial, unlinked, empty, noSources, extraField] = await Promise.all([
      other.api.post("/v1/material-questions", { data: materialQuestion([upload.id]) }),
      learner.api.post("/v1/material-questions", { data: materialQuestion([notLinked.id]) }),
      learner.api.post("/v1/material-questions", {
        data: { ...materialQuestion([upload.id]), question: " " },
      }),
      learner.api.post("/v1/material-questions", { data: materialQuestion([]) }),
      learner.api.post("/v1/material-questions", {
        data: { ...materialQuestion([upload.id]), userId: "x" },
      }),
    ]);

    expect(
      [othersMaterial, unlinked, empty, noSources, extraField].map((res) => res.status()),
    ).toStrictEqual([404, 404, 400, 400, 400]);

    // Guests have no tutor messages, so the question is refused before anything reads it.
    const guestQuestion = await guest.guestApi.post("/v1/material-questions", {
      data: materialQuestion([guestUpload.id]),
    });

    expect(guestQuestion.status()).toBe(403);

    await expect(guestQuestion.json()).resolves.toMatchObject({
      error: { code: "USAGE_LIMIT_REACHED", details: { limit: { tier: "guest" } } },
    });

    await Promise.all([learner.api.dispose(), other.api.dispose(), guest.guestApi.dispose()]);
  });

  test("lists a goal's recent change notices for its learner only", async () => {
    const [learner, other] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "change-notices" }),
      createBearerLearner({ baseURL, prefix: "change-notices-other" }),
    ]);

    const [blueprint, notice, law, unrelated] = await Promise.all([
      examBlueprintFixture(),
      sourceFixture({ title: "Exam notice" }),
      sourceFixture({ title: "Civil Code" }),
      sourceFixture({ title: "Someone else's law" }),
    ]);

    const goal = await goalFixture({
      createdAt: new Date(Date.now() - DAY_MS),
      examBlueprintId: blueprint.id,
      kind: "exam",
      userId: learner.userId,
    });

    await learnerSourceFixture({ goalId: goal.id, sourceId: law.id, userId: learner.userId });

    const [examNotice, lawNotice] = await Promise.all([
      sourceChangeNoticeFixture({
        createdAt: hoursAgo(2),
        examBlueprintId: blueprint.id,
        sourceId: notice.id,
      }),
      sourceChangeNoticeFixture({
        createdAt: hoursAgo(1),
        fields: ["text"],
        message: "The Civil Code changed article 5.",
        sourceId: law.id,
      }),
      // Before the goal started, so the plan already reflects it.
      sourceChangeNoticeFixture({ createdAt: new Date(Date.now() - 2 * DAY_MS), sourceId: law.id }),
      sourceChangeNoticeFixture({ createdAt: hoursAgo(1), sourceId: unrelated.id }),
    ]);

    const { notices } = await readBody({
      response: await learner.api.get(`/v1/source-change-notices?goalId=${goal.id}`),
      schema: changeNoticesResponseSchema,
    });

    expect(notices).toStrictEqual([
      {
        createdAt: lawNotice.createdAt.toISOString(),
        examBlueprintId: null,
        fields: ["text"],
        id: lawNotice.id,
        message: "The Civil Code changed article 5.",
        sourceId: law.id,
      },
      expect.objectContaining({ examBlueprintId: blueprint.id, id: examNotice.id }),
    ]);

    const anonymous = await request.newContext({ baseURL });

    const [signedOut, hidden, unknown, missing, invalid] = await Promise.all([
      anonymous.get(`/v1/source-change-notices?goalId=${goal.id}`),
      other.api.get(`/v1/source-change-notices?goalId=${goal.id}`),
      learner.api.get(`/v1/source-change-notices?goalId=${randomUUID()}`),
      learner.api.get("/v1/source-change-notices"),
      learner.api.get("/v1/source-change-notices?goalId=not-a-goal"),
    ]);

    expect([signedOut, hidden, unknown, missing, invalid].map((res) => res.status())).toStrictEqual(
      [401, 404, 404, 400, 400],
    );

    await Promise.all([learner.api.dispose(), other.api.dispose(), anonymous.dispose()]);
  });
});
